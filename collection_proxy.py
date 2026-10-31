"""Start the local collection API and compiled frontend preview."""
import argparse
import sys
from pathlib import Path
from data_directory import DataDirectoryRedirected, relaunch_from_desktop
from local_server import create_server

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--storage-relaunch', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    try:
        server = create_server(args.port)
    except DataDirectoryRedirected:
        if args.storage_relaunch:
            raise
        relaunch_from_desktop(Path(__file__), sys.argv[1:])
        print('已通过 Windows 桌面启动预览，使用正式用户数据库。', flush=True)
        raise SystemExit(0)
    print(f'Deck Dust: http://127.0.0.1:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

