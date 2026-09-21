// Ten cache, tang so nay len moi khi cap nhat app de xoa cache cu
const CACHE_NAME = "lich-sang-v3";

// Danh sach file can cache de app chay duoc khi mat mang
const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

// Cai dat: luu san cac file vao cache
self.addEventListener("install", function (event) {

    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {

            return cache.addAll(FILES_TO_CACHE);
        })
    );

    self.skipWaiting();
});

// Kich hoat: xoa cache cu neu co
self.addEventListener("activate", function (event) {

    event.waitUntil(
        caches.keys().then(function (keys) {

            return Promise.all(
                keys
                    .filter(function (key) {
                        return key !== CACHE_NAME;
                    })
                    .map(function (key) {
                        return caches.delete(key);
                    })
            );
        })
    );

    self.clients.claim();
});

// Lay file: uu tien tai ban moi nhat tu mang truoc (network-first)
// Chi dung ban da cache khi khong co mang (offline)
// Cach nay dam bao moi lan cap nhat code tren GitHub se duoc ap dung ngay
self.addEventListener("fetch", function (event) {

    event.respondWith(
        fetch(event.request)
            .then(function (response) {

                // Tai thanh cong tu mang: cap nhat lai cache voi ban moi nhat
                const responseClone = response.clone();

                caches.open(CACHE_NAME).then(function (cache) {

                    cache.put(event.request, responseClone);
                });

                return response;
            })
            .catch(function () {

                // Khong co mang: dung tam ban da luu trong cache
                return caches.match(event.request);
            })
    );
});
