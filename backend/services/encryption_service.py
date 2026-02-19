"""
AES-256-CBC encryption service for court-admissible video evidence.
SHA-256 hash of the ORIGINAL file is the legal fingerprint.
"""
import os
import hashlib
import secrets
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from config import settings


def _get_key() -> bytes:
    """Get 32-byte AES key from settings."""
    key_hex = settings.ENCRYPTION_KEY
    # Ensure exactly 32 bytes
    key_bytes = key_hex.encode("utf-8")[:32].ljust(32, b"0")
    return key_bytes


def generate_file_hashes(file_path: str) -> dict:
    """
    Compute SHA-256 and MD5 hashes of a file.
    These are the legal fingerprints — compute BEFORE encryption.
    """
    sha256 = hashlib.sha256()
    md5 = hashlib.md5()

    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
            md5.update(chunk)

    return {
        "sha256": sha256.hexdigest(),
        "md5": md5.hexdigest(),
    }


def encrypt_video(input_path: str, output_path: str) -> dict:
    """
    Encrypt a video file using AES-256-CBC.
    IV is prepended to the encrypted file (first 16 bytes).
    Returns: {encrypted_path, sha256_hash, md5_hash, iv_hex, key_hash}
    """
    # Compute hashes of ORIGINAL file first (legal fingerprint)
    hashes = generate_file_hashes(input_path)

    key = _get_key()
    iv = secrets.token_bytes(16)  # Random IV for each file

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(input_path, "rb") as f_in:
        plaintext = f_in.read()

    # Pad to 16-byte boundary (PKCS7)
    pad_len = 16 - (len(plaintext) % 16)
    plaintext += bytes([pad_len] * pad_len)

    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(plaintext) + encryptor.finalize()

    # Write IV + ciphertext
    with open(output_path, "wb") as f_out:
        f_out.write(iv + ciphertext)

    # Hash of the key (NOT the key itself) for audit trail
    key_hash = hashlib.sha256(key).hexdigest()

    return {
        "encrypted_path": output_path,
        "sha256_hash": hashes["sha256"],
        "md5_hash": hashes["md5"],
        "iv_hex": iv.hex(),
        "key_hash": key_hash,
    }


def decrypt_video(encrypted_path: str, output_path: str) -> str:
    """
    Decrypt an AES-256-CBC encrypted video file.
    Returns path to decrypted file.
    """
    key = _get_key()

    with open(encrypted_path, "rb") as f:
        data = f.read()

    iv = data[:16]
    ciphertext = data[16:]

    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    plaintext = decryptor.update(ciphertext) + decryptor.finalize()

    # Remove PKCS7 padding
    pad_len = plaintext[-1]
    if 1 <= pad_len <= 16:
        plaintext = plaintext[:-pad_len]

    dest_dir = os.path.dirname(output_path)
    if dest_dir:
        os.makedirs(dest_dir, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(plaintext)

    return output_path


def verify_hash(encrypted_path: str, expected_sha256: str) -> dict:
    """
    Decrypt the file temporarily and verify its SHA-256 hash.
    Returns verification result — proves tamper-evident storage.
    """
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        decrypt_video(encrypted_path, tmp_path)
        computed = generate_file_hashes(tmp_path)
        matches = computed["sha256"].lower() == expected_sha256.lower()
        return {
            "valid": matches,
            "computed_hash": computed["sha256"],
            "expected_hash": expected_sha256,
            "matches": matches,
        }
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
