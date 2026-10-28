# Website PT Talenta Teknik Mandiri

Website satu halaman berbahan company profile PT Talenta Teknik Mandiri.
HTML/CSS/JS statis, tanpa build step. Bisa diunggah ke hosting apa pun (cPanel, Netlify, Vercel, GitHub Pages).

## Menjalankan di komputer

Dari dalam folder repo ini:

```bash
python3 -m http.server 5317
```

Lalu buka http://localhost:5317.

## Struktur

- `index.html`: semua konten dan teks halaman
- `assets/css/style.css`: warna, tipografi, layout (token warna ada di `:root`)
- `assets/js/scene.js`: hero 3D (die set dirakit lalu dibongkar saat di-scroll), memakai Three.js
- `assets/js/main.js`: smooth scroll (Lenis), transisi scroll (GSAP ScrollTrigger), galeri, lightbox, form
- `assets/img/`: logo, foto mesin (`mesin/`), dan foto proyek (`galeri/`) yang diambil dari PDF

Library dimuat dari CDN jsDelivr dengan versi terkunci: three@0.160.0, gsap@3.12.5, lenis@1.1.13.

## Yang perlu diperhatikan

- Foto dari PDF beresolusi kecil (sekitar 250–500 px). Ganti file di `assets/img/galeri/` dengan foto asli
  beresolusi tinggi memakai nama file yang sama, lalu sesuaikan atribut `width`/`height` di `index.html`.
- Form kontak tidak butuh server: pesan disusun lalu dibuka di WhatsApp (0812 8321 2599) atau aplikasi email.
- Nomor WhatsApp dan email diatur di bagian atas `assets/js/main.js` (`WA_NUMBER`, `EMAIL`).
- Bila perangkat tidak mendukung WebGL, hero otomatis memakai foto CNC sebagai latar.
