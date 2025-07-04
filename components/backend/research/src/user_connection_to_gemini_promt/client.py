import socket

HOST = "127.0.0.1"
PORT = 8000

def main():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.connect((HOST, PORT))
        print(f"Connected to server at {HOST}:{PORT}")

        response = sock.recv(1024).decode()
        print(f"Server: {response.strip()}")
        
        user_id = input("Your ID: ")
        sock.sendall(user_id.encode("utf-8"))

        response = sock.recv(1024).decode()
        print(f"Server: {response.strip()}")

        response = sock.recv(1024).decode()
        print(f"Server: {response.strip()}")

        while True:
            message = input("You: ")
            if message.lower() in ("exit", "quit"):
                print("Exiting...")
                break

            sock.sendall(message.encode("utf-8"))



if __name__ == "__main__":
    main()