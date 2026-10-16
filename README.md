# CleanCut — AI Background Remover

CleanCut is a Flask web app that creates transparent image cutouts with `rembg`. The editor supports JPG, PNG, and WebP uploads up to 10 MB, custom preview backgrounds, and PNG/JPG downloads.

## Requirements

- Python 3.13 on Windows
- The Microsoft Visual C++ Redistributable (x64), required by ONNX Runtime

## Run on Windows

```powershell
py install 3.13
py -3.13 -m venv .venv313
.\.venv313\Scripts\python.exe -m pip install --upgrade pip
.\.venv313\Scripts\python.exe -m pip install -r requirements.txt
.\.venv313\Scripts\python.exe app.py
```

Open `http://127.0.0.1:5000` while the terminal running the server remains open. The first background-removal request downloads the `birefnet-general-lite` model, which may take time and disk space. This lighter model is selected to reduce processing time on CPU-only computers while still providing detailed cutouts.

## Admin panel

The site includes a small admin area to update the brand text, footer credit, contact email, and accent color. The default admin code is `049822` unless you override it with `ADMIN_CODE`:

```powershell
$env:ADMIN_CODE = "049822"
$env:CONTACT_EMAIL = "you@example.com"
.\.venv313\Scripts\python.exe app.py
```

Then open `http://127.0.0.1:5000/admin/login` and enter the admin code.

## Before public deployment

The development server started by `app.py` is not intended for production. Deploy behind a production WSGI server and HTTPS, configure a real domain and contact address, and review the About, Privacy, and Contact pages against the services and data handling on the deployed site. Google AdSense approval cannot be guaranteed by the code; Google reviews the public site and its content and policy compliance.
