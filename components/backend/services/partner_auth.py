import base64
import hashlib
import os
import secrets

SCRYPT_PARAMS = {"n": 2**14, "r": 8, "p": 1}
SALT_LEN = 16
KEY_LEN = 64


def hash_password(password: str) -> str:
    salt = os.urandom(SALT_LEN)
    dk = hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=SCRYPT_PARAMS["n"],
        r=SCRYPT_PARAMS["r"],
        p=SCRYPT_PARAMS["p"],
        dklen=KEY_LEN,
    )
    salt_b64 = base64.b64encode(salt).decode()
    hash_b64 = base64.b64encode(dk).decode()
    return f"scrypt${SCRYPT_PARAMS['n']}${SCRYPT_PARAMS['r']}${SCRYPT_PARAMS['p']}${salt_b64}${hash_b64}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    try:
        parts = stored_hash.split("$")
        if len(parts) != 6 or parts[0] != "scrypt":
            return False

        n = int(parts[1])
        r = int(parts[2])
        p = int(parts[3])
        salt = base64.b64decode(parts[4])
        expected = base64.b64decode(parts[5])

        dk = hashlib.scrypt(
            plain_password.encode(),
            salt=salt,
            n=n,
            r=r,
            p=p,
            dklen=len(expected),
        )
        return secrets.compare_digest(dk, expected)
    except Exception:
        return False
