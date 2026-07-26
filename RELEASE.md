# Release Notes - Remove-AI-Watermarks v0.21.0

Unified release adding Video & Audio AI Watermark removal, Samsung One UI Edge Panel & Share Sheet integrations, Browser Extension, Smart Filename Sanitizer, and 1-Click GUI Studio Launchers.

---

## 🚀 New Features

* **🎥 Video AI Watermark Removal Engine (`video_engine.py`)**:
  * Frame-by-frame visible watermark localization and inpainting for AI video generators (Sora, Kling 3.0, Runway Gen-3, Luma, MiniMax, Samsung Galaxy AI video watermarks).
  * Optical flow temporal anti-flicker mask smoothing across consecutive video frames.
  * Lossless video container metadata stripping and original audio stream re-stitching via `ffmpeg`.
  * CLI command: `remove-ai-watermarks video --input <video_file> --output <clean_video>`.

* **🎵 Audio AI Watermark & Artifact Suppression (`audio_engine.py`)**:
  * Spectral phase perturbation and adaptive notch filtering to neutralize invisible audio watermarks (ElevenLabs, Suno, Udio, Meta AudioSeal).
  * `suppress_audio_artifacts()` pass for high-pass power-hum filtering (< 60Hz) and comb-filter distortion reduction.
  * CLI command: `remove-ai-watermarks audio --input <audio_file> --output <clean_audio>`.

* **🏷️ Smart Filename & EXIF Humanizer (`filename_humanizer.py`)**:
  * Automatic AI filename pattern detection (`ChatGPT_Image_*`, `Gemini_Generated_*`, `DALL·E_*`, `SDXL_*`, `Kling_*`, `Jimeng_*`, `Doubao_*`).
  * Transforms AI filenames into natural camera roll patterns (`samsung` `20260726_083908.jpg`, `dslr` `DSC_4829.jpg`, `iphone` `IMG_8492.png`).
  * Synthesizes non-AI smartphone / DSLR EXIF metadata (Make: Samsung, Model: Galaxy S24 Ultra, ISO 50, Aperture f/1.7).

* **📱 Samsung One UI & Mobile Integration**:
  * **Samsung Share Sheet**: Registered `ACTION_SEND` intent receivers for `image/*`, `video/*`, and `audio/*` in Samsung Gallery.
  * **One UI Edge Panel Widget** (`CleanEdgeWidgetProvider.java`): 1-tap side-drawer widget for instant media cleaning and quick launch into Samsung Video Editor.
  * **S-Pen Smart Select Support** (`SPenSmartSelectActivity.java`): Process floating crop selections and S-Pen Air Commands.
  * **Samsung Video Editor Hand-off**: Direct 1-tap button to launch `com.samsung.android.videoeditor` with cleaned clips.
  * **Named APK Release**: Built native output binary named `AI-Watermark-Remover-Studio.apk`.

* **🎨 1-Click GUI Studio Launchers**:
  * macOS Launcher: Double-clickable `Launch AI Studio.command` opens local server and pops open GUI browser window.
  * Windows Launcher: Double-clickable `Start AI Studio.bat`.

* **🌐 Manifest V3 Browser Extension**:
  * Manifest V3 extension in `extension/` providing right-click *"Clean AI Watermark & Download"* context menu action for web images and video clips.

---

## 🐛 Bug Fixes

* Fixed `unsharp_mask` float32 edge case rounding shift on flat uniform images in `humanizer.py`.
* Added Python 3.9 compatibility for type union annotations in `humanizer.py`.
* Fixed `ffmpeg` missing exception fallback in `audio_engine.py` to copy container files safely without crashing.
* Fixed temp directory prefixing to `watermark_remover_video_`.

---

## 🧹 Code Refactoring & Cleanup

* Lazy module loading via PEP 562 in `__init__.py` for `process_video`, `process_audio`, and `filename_humanizer`.
* Standardized test suite across all engines (`tests/test_video_audio_engines.py`, `tests/test_filename_humanizer.py`).
* Upgraded Android Gradle wrapper to 8.4/8.12 with Java 17 compile options.

---

## 🔒 Security & Privacy Updates

* Audited entire repository for exposed API keys, private tokens, passwords, and secret env vars — **0 exposed secrets found**.
* Restricted Android permissions strictly to standard media access (`READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`).
* Offloaded all temporary working directories safely into temporary system paths.
