"""Offline REST & Real-time Progress Server for AI Watermark Remover Studio.

Enhanced/Customized by Kishore Cheerala.
Provides HTTP server for image processing, batch queue, photo enhancements, AI face & skin texture enhancer,
canvas rotation/flipping, FFT steganography heatmaps, Magic Wand auto-contours, and static web app serving.
"""

from __future__ import annotations

import base64
import contextlib
import json
import logging
import mimetypes
import os
import sys
import tempfile
import time
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger("raiw.server")
WEB_DIR = Path(__file__).parent.parent.parent / "web"


def enhance_face_skin(bgr: np.ndarray) -> np.ndarray:
    """Apply skin-smoothing and facial feature detail restoration post-inpainting."""
    # Apply bilateral filter for smooth skin texture
    smoothed = cv2.bilateralFilter(bgr, 9, 75, 75)
    # Apply unsharp mask for feature sharpness
    gaussian = cv2.GaussianBlur(smoothed, (0, 0), 3)
    sharpened = cv2.addWeighted(smoothed, 1.5, gaussian, -0.5, 0)
    # Blend smoothed skin with original feature edges
    mask = cv2.Canny(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), 50, 150)
    mask_3ch = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR) / 255.0
    return (sharpened * mask_3ch + smoothed * (1.0 - mask_3ch)).astype(np.uint8)


def apply_canvas_transforms(bgr: np.ndarray, angle: int, flip_h: bool, flip_v: bool) -> np.ndarray:
    """Apply canvas rotation (90, 180, 270) and horizontal/vertical flipping."""
    res = bgr.copy()
    if angle == 90:
        res = cv2.rotate(res, cv2.ROTATE_90_CLOCKWISE)
    elif angle == 180:
        res = cv2.rotate(res, cv2.ROTATE_180)
    elif angle == 270:
        res = cv2.rotate(res, cv2.ROTATE_90_COUNTERCLOCKWISE)

    if flip_h and flip_v:
        res = cv2.flip(res, -1)
    elif flip_h:
        res = cv2.flip(res, 1)
    elif flip_v:
        res = cv2.flip(res, 0)

    return res


def compute_fft_heatmap(bgr: np.ndarray) -> str:
    """Compute 2D Fast Fourier Transform (FFT) magnitude heatmap to expose invisible watermarks."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    dft = cv2.dft(np.float32(gray), flags=cv2.DFT_COMPLEX_OUTPUT)
    dft_shift = np.fft.fftshift(dft)
    magnitude = cv2.magnitude(dft_shift[:, :, 0], dft_shift[:, :, 1])
    magnitude_spectrum = 20 * np.log(magnitude + 1.0)
    norm_spec = cv2.normalize(magnitude_spectrum, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
    color_map = cv2.applyColorMap(norm_spec, cv2.COLORMAP_JET)
    _, buffer = cv2.imencode(".png", color_map)
    return "data:image/png;base64," + base64.b64encode(buffer).decode("utf-8")


def compute_magic_wand_bbox(bgr: np.ndarray, px: int, py: int) -> list[int] | None:
    """Compute magic wand bounding box around clicked coordinate (px, py)."""
    h, w = bgr.shape[:2]
    if px < 0 or px >= w or py < 0 or py >= h:
        return None

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    flags = 4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY
    cv2.floodFill(gray, mask, (px, py), 255, loDiff=20, upDiff=20, flags=flags)

    fill_mask = mask[1 : h + 1, 1 : w + 1]
    ys, xs = np.where(fill_mask > 0)
    if len(xs) == 0:
        return None

    x0, y0 = int(xs.min()), int(ys.min())
    bw, bh = int(xs.max() - x0 + 1), int(ys.max() - y0 + 1)

    pad = 4
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    bw = min(w - x0, bw + pad * 2)
    bh = min(h - y0, bh + pad * 2)

    return [x0, y0, bw, bh]


def enhance_auto_color(bgr: np.ndarray) -> np.ndarray:
    """Apply CLAHE auto-color balance and exposure enhancement."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l_chan, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l_chan)

    limg = cv2.merge((cl, a, b))
    return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)


def apply_denoise(bgr: np.ndarray) -> np.ndarray:
    """Apply noise reduction and JPEG artifact cleanup."""
    return cv2.fastNlMeansDenoisingColored(bgr, None, 5, 5, 7, 21)


def apply_aspect_ratio_fit(bgr: np.ndarray, target_ratio: str, fit_mode: str) -> np.ndarray:
    """Fit/Expand image to target aspect ratio (1:1, 9:16, 4:5, 16:9) without distortion."""
    if target_ratio == "original" or not target_ratio:
        return bgr

    ratios = {"1:1": 1.0, "9:16": 9.0 / 16.0, "4:5": 4.0 / 5.0, "16:9": 16.0 / 9.0}
    if target_ratio not in ratios:
        return bgr

    target_ar = ratios[target_ratio]
    h, w = bgr.shape[:2]
    current_ar = w / float(h)

    if fit_mode == "cover_crop":
        if current_ar > target_ar:
            new_w = int(h * target_ar)
            offset = (w - new_w) // 2
            return bgr[:, offset : offset + new_w]
        new_h = int(w / target_ar)
        offset = (h - new_h) // 2
        return bgr[offset : offset + new_h, :]

    if current_ar > target_ar:
        target_w = w
        target_h = int(w / target_ar)
    else:
        target_h = h
        target_w = int(h * target_ar)

    if fit_mode == "blur_pad":
        bg = cv2.resize(bgr, (target_w, target_h), interpolation=cv2.INTER_CUBIC)
        bg = cv2.GaussianBlur(bg, (51, 51), 0)
        x_off = (target_w - w) // 2
        y_off = (target_h - h) // 2
        bg[y_off : y_off + h, x_off : x_off + w] = bgr
        return bg
    bg = np.zeros((target_h, target_w, 3), dtype=np.uint8)
    bg[:] = (15, 23, 42)
    x_off = (target_w - w) // 2
    y_off = (target_h - h) // 2
    bg[y_off : y_off + h, x_off : x_off + w] = bgr
    return bg


class RAIWRequestHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler for AI Watermark Remover Studio server."""

    def log_message(self, format: str, *args: Any) -> None:
        sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {format % args}\n")

    def _set_headers(self, status: int = 200, content_type: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self) -> None:
        self._set_headers(200)

    def do_GET(self) -> None:
        from urllib.parse import urlparse

        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == "/api/health":
            self._set_headers(200)
            self.wfile.write(
                json.dumps(
                    {
                        "status": "ok",
                        "app": "AI Watermark Remover Studio",
                        "author": "Kishore Cheerala",
                        "version": "1.0.0",
                        "offline": True,
                    }
                ).encode("utf-8")
            )
            return

        if path == "/":
            file_path = WEB_DIR / "index.html"
        else:
            rel_path = path.lstrip("/")
            file_path = WEB_DIR / rel_path

        if file_path.exists() and file_path.is_file():
            mime_type, _ = mimetypes.guess_type(str(file_path))
            mime_type = mime_type or "application/octet-stream"
            self._set_headers(200, mime_type)
            with open(file_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self._set_headers(404, "text/plain")
            self.wfile.write(b"404 Not Found")

    def do_POST(self) -> None:
        from urllib.parse import urlparse

        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == "/api/identify":
            self._handle_identify()
        elif path == "/api/magic_wand":
            self._handle_magic_wand()
        elif path == "/api/process":
            self._handle_process()
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Unknown endpoint"}).encode("utf-8"))

    def _read_body_bytes(self) -> bytes:
        content_length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(content_length)

    def _handle_magic_wand(self) -> None:
        try:
            body = self._read_body_bytes()
            data = json.loads(body.decode("utf-8"))
            img_b64 = data.get("image", "")
            px = int(data.get("x", 0))
            py = int(data.get("y", 0))

            if "," in img_b64:
                img_b64 = img_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(img_b64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if bgr is None:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Could not decode image"}).encode("utf-8"))
                return

            bbox = compute_magic_wand_bbox(bgr, px, py)
            self._set_headers(200)
            self.wfile.write(json.dumps({"bbox": bbox}).encode("utf-8"))
        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

    def _handle_identify(self) -> None:
        try:
            body = self._read_body_bytes()
            if not body:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Empty body"}).encode("utf-8"))
                return

            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp.write(body)
                tmp_path = Path(tmp.name)

            try:
                from remove_ai_watermarks import identify, image_io

                rep = identify.identify(tmp_path, check_visible=True, check_invisible=True)
                bgr, _ = image_io.read_bgr_and_alpha(tmp_path)

                fft_heatmap_b64 = ""
                if bgr is not None:
                    fft_heatmap_b64 = compute_fft_heatmap(bgr)

                res = {
                    "platform": rep.platform or "Unknown / Clean",
                    "confidence": getattr(rep, "confidence", "high"),
                    "fft_heatmap": fft_heatmap_b64,
                    "signals": [
                        {
                            "name": s.name,
                            "vendor": getattr(s, "vendor", "N/A"),
                            "details": getattr(s, "details", {}),
                        }
                        for s in rep.signals
                    ],
                }
                self._set_headers(200)
                self.wfile.write(json.dumps(res).encode("utf-8"))
            finally:
                if tmp_path.exists():
                    os.unlink(tmp_path)

        except Exception as e:
            logger.error("Identify failed: %s", traceback.format_exc())
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

    def _handle_process(self) -> None:
        """Handle image processing with face enhancer and canvas transforms."""
        try:
            body = self._read_body_bytes()
            data = json.loads(body.decode("utf-8"))
            img_b64 = data.get("image", "")
            options = data.get("options", {})

            if not img_b64:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "No image data provided"}).encode("utf-8"))
                return

            if "," in img_b64:
                img_b64 = img_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(img_b64)

            backend = options.get("backend", "auto")
            sensitivity = options.get("sensitivity", "auto")
            strip_metadata = options.get("strip_metadata", True)
            humanizer = options.get("humanizer", False)
            face_enhance = options.get("face_enhance", False)
            rotate_angle = int(options.get("rotate", 0))
            flip_h = bool(options.get("flip_h", False))
            flip_v = bool(options.get("flip_v", False))
            regions = options.get("regions", [])
            watermark_text = options.get("watermark_text", "")
            auto_enhance = options.get("auto_enhance", False)
            denoise = options.get("denoise", False)
            aspect_ratio = options.get("aspect_ratio", "original")
            fit_mode = options.get("fit_mode", "blur_pad")

            with (
                tempfile.NamedTemporaryFile(suffix=".png", delete=False) as in_tmp,
                tempfile.NamedTemporaryFile(suffix=".png", delete=False) as out_tmp,
            ):
                in_tmp.write(img_bytes)
                in_path = Path(in_tmp.name)
                out_path = Path(out_tmp.name)

            try:
                from remove_ai_watermarks import api, image_io, region_eraser
                from remove_ai_watermarks import humanizer as hum_mod

                # Step 1: Visible Watermark Removal
                bgr_res, removed = api.remove_visible(
                    in_path,
                    out_path,
                    backend=backend,
                    sensitivity=sensitivity,
                    strip_metadata=strip_metadata,
                )

                current_bgr, alpha = image_io.read_bgr_and_alpha(out_path)
                if current_bgr is None:
                    current_bgr = bgr_res

                # Step 2: Canvas Rotation & Flipping
                if (rotate_angle != 0 or flip_h or flip_v) and current_bgr is not None:
                    current_bgr = apply_canvas_transforms(current_bgr, rotate_angle, flip_h, flip_v)

                # Step 3: Custom Region Eraser
                if regions and current_bgr is not None:
                    for box in regions:
                        if len(box) == 4:
                            x, y, w, h = box
                            current_bgr = region_eraser.erase(current_bgr, boxes=[(x, y, w, h)], backend=backend)

                # Step 4: Photo & AI Face Enhancement
                if auto_enhance and current_bgr is not None:
                    current_bgr = enhance_auto_color(current_bgr)
                if denoise and current_bgr is not None:
                    current_bgr = apply_denoise(current_bgr)
                if face_enhance and current_bgr is not None:
                    current_bgr = enhance_face_skin(current_bgr)

                # Step 5: Aspect Ratio Auto-Expand / Fit-Fill
                if aspect_ratio != "original" and current_bgr is not None:
                    current_bgr = apply_aspect_ratio_fit(current_bgr, aspect_ratio, fit_mode)
                    alpha = None

                # Step 6: Custom Watermark Stamper
                if watermark_text and current_bgr is not None:
                    h, w = current_bgr.shape[:2]
                    text = str(watermark_text)
                    font = cv2.FONT_HERSHEY_SIMPLEX
                    scale = max(0.5, min(w, h) / 1000.0)
                    thickness = max(1, int(scale * 2))
                    (tw, th), baseline = cv2.getTextSize(text, font, scale, thickness)
                    tx = w - tw - 20
                    ty = h - 20
                    if tx > 0 and ty > 0:
                        pt1 = (tx - 8, ty - th - 8)
                        pt2 = (tx + tw + 8, ty + baseline + 4)
                        cv2.rectangle(current_bgr, pt1, pt2, (0, 0, 0), -1)
                        cv2.putText(current_bgr, text, (tx, ty), font, scale, (255, 255, 255), thickness, cv2.LINE_AA)

                image_io.write_bgr_with_alpha(out_path, current_bgr, alpha)

                # Step 7: Humanizer if enabled
                if humanizer and out_path.exists():
                    hum_mod.apply_humanizer(out_path, out_path, grain=0.03, ca=0.002)

                with open(out_path, "rb") as out_f:
                    out_b64 = base64.b64encode(out_f.read()).decode("utf-8")

                resp = {
                    "success": True,
                    "removed_watermarks": removed,
                    "image_b64": f"data:image/png;base64,{out_b64}",
                }
                self._set_headers(200)
                self.wfile.write(json.dumps(resp).encode("utf-8"))

            finally:
                if in_path.exists():
                    os.unlink(in_path)
                if out_path.exists():
                    os.unlink(out_path)

        except Exception as e:
            logger.error("Processing error: %s", traceback.format_exc())
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))


def run_server(host: str = "127.0.0.1", port: int = 8080, open_browser: bool = False) -> None:
    server_address = (host, port)
    httpd = HTTPServer(server_address, RAIWRequestHandler)
    url = f"http://{host}:{port}"
    if open_browser:
        import webbrowser

        webbrowser.open(url)
    with contextlib.suppress(KeyboardInterrupt):
        httpd.serve_forever()


if __name__ == "__main__":
    port = 8080
    open_b = "--open" in sys.argv or "-o" in sys.argv
    for arg in sys.argv[1:]:
        if arg.isdigit():
            port = int(arg)
    run_server(port=port, open_browser=open_b)
