const fs = require('fs');

const SIGNATURES = [
    { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
    { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
    { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
    { mime: 'video/webm', bytes: [0x1A, 0x45, 0xDF, 0xA3] },
    { mime: 'audio/ogg', bytes: [0x4F, 0x67, 0x67, 0x53] }
];

function matches(buffer, bytes) {
    for (let i = 0; i < bytes.length; i++) {
        if (buffer[i] !== bytes[i]) return false;
    }
    return true;
}

// RIFF container -> kiểm tra xem là WEBP hay không
function sniffWebp(buffer) {
    if (buffer.length < 12) return null;
    const riff = String.fromCharCode(...buffer.subarray(0, 4));
    const webp = String.fromCharCode(...buffer.subarray(8, 12));
    return riff === 'RIFF' && webp === 'WEBP' ? 'image/webp' : null;
}

// ISO BMFF container (ftyp) -> mp4
function sniffMp4(buffer) {
    if (buffer.length < 12) return null;
    const ftyp = String.fromCharCode(...buffer.subarray(4, 8));
    return ftyp === 'ftyp' ? 'video/mp4' : null;
}

function sniffType(buffer) {
    for (const sig of SIGNATURES) {
        if (matches(buffer, sig.bytes)) return sig.mime;
    }
    return sniffWebp(buffer) || sniffMp4(buffer) || null;
}

function sniffFileType(filePath, bytesToRead = 16) {
    const fd = fs.openSync(filePath, 'r');
    try {
        const buf = Buffer.alloc(bytesToRead);
        const bytesRead = fs.readSync(fd, buf, 0, bytesToRead, 0);
        return sniffType(buf.subarray(0, bytesRead));
    } finally {
        fs.closeSync(fd);
    }
}

module.exports = { sniffType, sniffFileType };
