let img;
let ditheredImg;
let color1, color2; // Rastgele seçilecek renkler

// 4x4 Bayer matrisi
const bayerMatrix = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
];
const matrixSize = bayerMatrix.length;

const targetWidth = 256;
const targetHeight = 256;

const imageList = [
    'TDMovieOut.0.jpg',
    'TDMovieOut.1.jpg',
    'TDMovieOut.2.jpg',
    'TDMovieOut.3.jpg',
    'TDMovieOut.4.jpg',
    'TDMovieOut.5.jpg',
    'TDMovieOut.6.jpg',
    'TDMovieOut.7.jpg',
    'TDMovieOut.8.jpg',
    'TDMovieOut.9.jpg',
    'TDMovieOut.10.jpg'
];

function preload() {
    // imageList dizisinden rastgele bir görsel seç
    currentImageName = random(imageList);
    const imagePath = `p5js/input-eyes/${currentImageName}`;
    img = loadImage(imagePath);
}
function setup() {
    // Tuvali belirtilen boyutta oluştur ve div'e yerleştir
    const p5Canvas = createCanvas(targetWidth, targetHeight);
    p5Canvas.parent('p5-container');

    pixelDensity(1);
    noLoop(); // Sadece bir kez çizim yapmak için döngüyü durdur

    // Her çalıştırmada rastgele iki renk seç
    color1 = color(random(128), random(128), random(128));
    color2 = color(random(128+128), random(128+128), random(128+128));

    // Orijinal görseli yeni boyuta yeniden boyutlandır
    img.resize(targetWidth, targetHeight);
}

function draw() {
    background(255);

    // Bayer Dithering
    ditheredImg = createImage(targetWidth, targetHeight);
    ditheredImg.loadPixels();
    img.loadPixels();

    for (let x = 0; x < targetWidth; x++) {
        for (let y = 0; y < targetHeight; y++) {
            const index = (x + y * targetWidth) * 4;

            const r = img.pixels[index];
            const g = img.pixels[index + 1];
            const b = img.pixels[index + 2];
            const brightness = (r + g + b) / 3;

            const bayerVal = bayerMatrix[x % matrixSize][y % matrixSize];
            const threshold = (bayerVal + 1) / (matrixSize * matrixSize + 1);

            let newBrightness;
            if (brightness / 255 > threshold) {
                newBrightness = 255;
            } else {
                newBrightness = 0;
            }

            ditheredImg.pixels[index] = newBrightness;
            ditheredImg.pixels[index + 1] = newBrightness;
            ditheredImg.pixels[index + 2] = newBrightness;
            ditheredImg.pixels[index + 3] = 255;
        }
    }
    ditheredImg.updatePixels();

    // Gradient Map
    ditheredImg.loadPixels();

    for (let x = 0; x < targetWidth; x++) {
        for (let y = 0; y < targetHeight; y++) {
            const index = (x + y * targetWidth) * 4;

            const brightness = ditheredImg.pixels[index];
            const amt = brightness / 255;

            const newColor = lerpColor(color1, color2, amt);

            ditheredImg.pixels[index] = red(newColor);
            ditheredImg.pixels[index + 1] = green(newColor);
            ditheredImg.pixels[index + 2] = blue(newColor);
            ditheredImg.pixels[index + 3] = 255;
        }
    }
    ditheredImg.updatePixels();

    image(ditheredImg, 0, 0);
}