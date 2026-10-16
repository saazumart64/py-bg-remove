from functools import lru_cache
from io import BytesIO
import json
import os
from pathlib import Path
from threading import Lock

from flask import Flask, jsonify, redirect, render_template, request, send_file, session, url_for
from PIL import Image, ImageOps, UnidentifiedImageError
from rembg import new_session, remove

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024
MAX_IMAGE_PIXELS = 40_000_000
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
BASE_DIR = Path(__file__).resolve().parent
SETTINGS_FILE = BASE_DIR / "site_settings.json"
session_lock = Lock()


def default_settings():
    return {
        "site_name": "CleanCut",
        "logo_text": "CleanCut",
        "footer_credit": "© 2026 CleanCut. All Rights Reserved.",
        "contact_email": os.environ.get("CONTACT_EMAIL", ""),
        "accent_color": "#5f7cff",
        "admin_code": os.environ.get("ADMIN_CODE", "049822"),
    }


def load_settings():
    default = default_settings()
    if not SETTINGS_FILE.exists():
        SETTINGS_FILE.write_text(json.dumps(default, indent=2), encoding="utf-8")
        return default

    try:
        stored = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default

    merged = default.copy()
    merged.update(stored)
    return merged


def save_settings(values):
    current = load_settings()
    current.update(values)
    SETTINGS_FILE.write_text(json.dumps(current, indent=2), encoding="utf-8")
    return current


def is_admin_authenticated():
    return bool(session.get("admin_authenticated"))


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BYTES
    app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "clean-cut-secret-key")

    @app.context_processor
    def inject_site_settings():
        return {
            "settings": load_settings(),
            "admin_authenticated": is_admin_authenticated(),
        }

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/about")
    def about():
        return render_template("about.html")

    @app.get("/privacy")
    def privacy():
        return render_template("privacy.html")

    @app.get("/contact")
    def contact():
        return render_template("contact.html")

    @app.route("/admin/login", methods=["GET", "POST"])
    def admin_login():
        settings = load_settings()
        error = None
        if request.method == "POST":
            code = (request.form.get("admin_code") or "").strip()
            expected = os.environ.get("ADMIN_CODE", settings.get("admin_code", "049822"))
            if code == expected:
                session["admin_authenticated"] = True
                return redirect(url_for("admin_panel"))
            error = "Invalid admin code. Please try again."
        return render_template("admin_login.html", settings=settings, error=error)

    @app.get("/admin/logout")
    def admin_logout():
        session.pop("admin_authenticated", None)
        return redirect(url_for("admin_login"))

    @app.route("/admin", methods=["GET", "POST"])
    def admin_panel():
        if not is_admin_authenticated():
            return redirect(url_for("admin_login"))

        settings = load_settings()
        success = False
        if request.method == "POST":
            form_values = {
                "site_name": (request.form.get("site_name") or settings.get("site_name", "CleanCut")).strip() or "CleanCut",
                "logo_text": (request.form.get("logo_text") or settings.get("logo_text", "CleanCut")).strip() or "CleanCut",
                "footer_credit": (request.form.get("footer_credit") or settings.get("footer_credit", "© 2026 CleanCut. All Rights Reserved.")).strip() or "© 2026 CleanCut. All Rights Reserved.",
                "contact_email": (request.form.get("contact_email") or "").strip(),
                "accent_color": (request.form.get("accent_color") or settings.get("accent_color", "#5f7cff")).strip() or "#5f7cff",
            }
            if request.form.get("admin_code"):
                form_values["admin_code"] = (request.form.get("admin_code") or "").strip() or settings.get("admin_code", "049822")
            settings = save_settings(form_values)
            success = True
        return render_template("admin.html", settings=settings, success=success)

    @app.post("/api/remove")
    def remove_background():
        uploaded_file = request.files.get("image")
        if uploaded_file is None or not uploaded_file.filename:
            return jsonify(error="Choose an image and try again."), 400

        try:
            image_data = uploaded_file.read(MAX_UPLOAD_BYTES + 1)
            if len(image_data) > MAX_UPLOAD_BYTES:
                return jsonify(error="Image must be 10 MB or smaller."), 413

            with Image.open(BytesIO(image_data)) as source:
                if source.format not in ALLOWED_FORMATS:
                    return jsonify(error="Upload a JPG, PNG, or WebP image."), 400
                if source.width * source.height > MAX_IMAGE_PIXELS:
                    return jsonify(error="This image resolution is too large. Please use a smaller image."), 400
                source.load()
                image = ImageOps.exif_transpose(source).convert("RGBA")
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
            return jsonify(error="We could not read that image. Please try another one."), 400

        try:
            with session_lock:
                removal_session = get_removal_session()
            result = remove(image, session=removal_session, decontaminate=True)
            output = BytesIO()
            result.save(output, format="PNG")
            output.seek(0)
        except (OSError, RuntimeError, ValueError):
            app.logger.exception("Background removal failed")
            return jsonify(error="Background removal failed. Please try again."), 500

        return send_file(
            output,
            mimetype="image/png",
            as_attachment=True,
            download_name="cleancut-background-removed.png",
        )

    @app.errorhandler(413)
    def upload_too_large(_error):
        return jsonify(error="Image must be 10 MB or smaller."), 413

    return app


@lru_cache(maxsize=1)
def get_removal_session():
    return new_session("birefnet-general-lite")


app = create_app()

if __name__ == "__main__":
    app.run(debug=False)
