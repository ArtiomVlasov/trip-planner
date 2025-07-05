import json
import os
import socket
import threading
from typing import Any, Dict
from google import genai
import parse_user_prompt



HOST = '127.0.0.1'  # loopback interface
PORT = 8000         # порт
API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")
assert API_KEY, "GOOGLE_GEMINI_API_KEY env var is not set"

path_to_users_db = "../../data_base/user_dataset.json"
with open(path_to_users_db, "r") as user_db:
    user_data = json.load(user_db)

def handle_client(conn: socket.socket, addr):
    print(f"[+] Connection from {addr}")#TODO loger needed
    

    conn.sendall(b"Enter your user ID: ")
    user_id = conn.recv(1024).decode().strip()

    if (user_id != user_data['user']['id']):
        conn.sendall(b"User not found. Registering new user...\n")
    else:
        conn.sendall(f"Welcome back, {user_data['user']['name']}!\n".encode())

    conn.sendall(b"You're connected. Type your messages.\n")
    client = genai.Client(api_key=API_KEY)
    chat = client.chats.create(model="gemini-2.5-flash")
    parse_user_prompt.send_context(chat=chat)

    while True:
        try:
            data = conn.recv(1024)
            if not data:
                print(f"[-] Disconnected {addr}")#TODO loger needed
                break
            message = data.decode().strip()
            print(f"[{user_id}@{addr}] {message}") #TODO loger needed

            processed_user_message = parse_user_prompt.send_user_promt(chat=chat, user_input=message)
            updated_user_dataset = update_user_dataset(original=user_data,processed_user_message=processed_user_message)
            with open(path_to_users_db, "w", encoding="utf-8") as f:
                json.dump(updated_user_dataset, f, indent=2, ensure_ascii=False)
        except ConnectionResetError:
            print(f"[!] Connection lost with {addr}")#TODO loger needed
            break

    conn.close()

def update_user_dataset(original: Dict[str, Any],processed_user_message:Dict[str, Any]) -> Dict[str, Any]:
    for key, value in processed_user_message.items():
        if isinstance(value, dict):
            original[key] = update_user_dataset(original.get(key, {}), value)
        elif value is not None:
            original[key] = value
    return original

def start_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind((HOST, PORT))
    server.listen()

    print(f"[*] Server listening on {HOST}:{PORT}...")

    while True:
        conn, addr = server.accept()
        thread = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
        thread.start()

if __name__ == "__main__":
    start_server()