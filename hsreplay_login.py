"""Official-site sign-in window. No account IDs or cookies are entered in the app."""
from __future__ import annotations

import argparse
import threading
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlparse

from hsreplay_auth import SessionVault, collection_identity


def run_login(data_dir: Path):
    import webview
    vault = SessionVault(data_dir)
    stopped = threading.Event()
    ready = threading.Event()
    gate = threading.Lock()
    observed = {}
    processing = False
    complete = False
    waiting_hint_sent = False
    fallback_attempted = False
    loaded_at = time.monotonic()
    last_probe_at = 0.0
    webview.settings['OPEN_EXTERNAL_LINKS_IN_BROWSER'] = False
    login_url = 'https://hsreplay.net/account/login/?hl=zh-hans&next=%2Fcollection%2Fmine%2F'
    window = webview.create_window('登录 HSReplay 国服账号', login_url,
                                   width=1100, height=850, min_size=(780, 620))

    def request_sent(request):
        identity = collection_identity(request.url)
        if not identity or processing:
            return
        if identity['region'] != 5:
            labels = {1: '美洲', 2: '欧洲', 3: '亚洲'}
            vault.write_status('wrong_region', f'检测到{labels[identity["region"]]}服务器账号。此处只接受中国服务器（region=5），请勿继续使用该账号同步。', region=identity['region'])
            return
        with gate:
            observed.clear()
            observed.update(identity, url=request.url, headers=request.headers)
        vault.write_status('importing', '已检测到中国区账号，正在确认账号并保存登录会话…', region=5)

    def on_loaded():
        nonlocal loaded_at, waiting_hint_sent, fallback_attempted
        logout = data_dir / 'hsreplay-logout.pending'
        if logout.exists() and urlparse(window.get_current_url() or '').hostname == 'hsreplay.net':
            window.clear_cookies()
            logout.unlink(missing_ok=True)
            window.load_url(login_url)
            return
        ready.set()
        loaded_at = time.monotonic()
        waiting_hint_sent = False
        fallback_attempted = False
        vault.write_status('waiting', '请在 HSReplay 登录页选择国服账号。只有中国服务器（region=5）账号会被保存；收藏只在应用启动或手动同步时获取。')

    def on_closed():
        stopped.set()
        if not complete and vault.read_status().get('phase') in ('opening', 'waiting', 'importing'):
            vault.write_status('cancelled', '登录窗口已关闭，尚未完成连接。')

    def parse_account_name(label):
        normalized = ' '.join(str(label or '').split())
        if '国服' not in normalized:
            return ''
        prefix = normalized.split('国服', 1)[0].rstrip('（(').strip()
        return prefix.rsplit(' ', 1)[-1] if prefix else ''

    def read_account_name():
        script = '(()=>{const root=document.querySelector("#user-nav")||document;const region=Array.from(root.querySelectorAll("*")).find(el=>el.children.length===0&&el.textContent.trim()==="国服");const account=region?.closest("button,[role=button]");const labels=Array.from(root.querySelectorAll("button,[role=button],a,[aria-label],[title]")).map(el=>[el.innerText,el.textContent,el.getAttribute("aria-label"),el.title].filter(Boolean).join(" ").trim());return {accountLabel:account?.textContent||labels.find(text=>text.includes("国服"))||root.textContent||""}})()'
        try:
            result = window.evaluate_js(script)
        except Exception:
            return ''
        return parse_account_name(result.get('accountLabel') if isinstance(result, dict) else '')

    def worker():
        nonlocal processing, complete, waiting_hint_sent, last_probe_at, fallback_attempted
        while not stopped.wait(.4):
            if not ready.is_set():
                continue
            with gate:
                candidate = dict(observed)
                observed.clear()
            if not candidate:
                current = urlparse(window.get_current_url() or '')
                # pywebview may miss the collection request event on some
                # WebView2 versions. Probe the signed-in page once per load;
                # never issue a second collection API request from this worker.
                if (ready.is_set() and current.hostname == 'hsreplay.net'
                        and current.path.rstrip('/') in ('/collection/mine', '/zh-hans/collection/mine')
                        and not fallback_attempted
                        and time.monotonic() - last_probe_at >= 2):
                    last_probe_at = time.monotonic()
                    fallback_attempted = True
                    probe_script = '(()=>{const root=document.querySelector("#user-nav")||document;const region=Array.from(root.querySelectorAll("*")).find(el=>el.children.length===0&&el.textContent.trim()==="国服");const account=region?.closest("button,[role=button]");const labels=Array.from(root.querySelectorAll("button,[role=button],a,[aria-label],[title]")).map(el=>[el.innerText,el.textContent,el.getAttribute("aria-label"),el.title].filter(Boolean).join(" ").trim());return {shareUrl:document.querySelector("#replay-share-url")?.value||"",userAgent:navigator.userAgent,accountLabel:account?.textContent||labels.find(text=>text.includes("国服"))||root.textContent||""}})()'
                    try:
                        probe_result = window.evaluate_js(probe_script)
                    except Exception:
                        probe_result = {}
                    if isinstance(probe_result, dict) and probe_result.get('shareUrl'):
                        share = urlparse(probe_result['shareUrl'])
                        parts = [part for part in share.path.split('/') if part]
                        if (share.scheme == 'https' and share.hostname == 'hsreplay.net'
                                and len(parts) >= 3 and parts[0] == 'collection'):
                            identity = collection_identity(
                                'https://hsreplay.net/api/v1/collection/?region='
                                + parts[1] + '&account_lo=' + parts[2]
                                + '&type=CONSTRUCTED')
                            if identity and identity['region'] == 5:
                                fallback_attempted = True
                                candidate = {
                                    **identity,
                                    'url': ('https://hsreplay.net/api/v1/collection/?region=5&account_lo='
                                            + identity['account'] + '&type=CONSTRUCTED'),
                                    'headers': {'user-agent': probe_result.get('userAgent', '')},
                                    'accountLabel': probe_result.get('accountLabel', ''),
                                }
                                vault.write_status('importing', '已识别国服账号，正在确认登录会话…', region=5)
                            elif identity:
                                labels = {1: '美洲', 2: '欧洲', 3: '亚洲'}
                                vault.write_status('wrong_region', f'检测到{labels[identity["region"]]}服务器账号。此处只接受中国服务器（region=5），请勿继续使用该账号同步。', region=identity['region'])
                    if candidate:
                        # Continue into the shared API fetch and validation path below.
                        pass
                    else:
                        if ready.is_set() and current.hostname == 'hsreplay.net' and not waiting_hint_sent and time.monotonic() - loaded_at > 15:
                            waiting_hint_sent = True
                            vault.write_status('waiting', '登录页面已打开，但还没有检测到收藏请求。请在此窗口进入或刷新“我的收藏”，并保持窗口打开。')
                        continue
                elif not candidate:
                    if ready.is_set() and current.hostname == 'hsreplay.net' and not waiting_hint_sent and time.monotonic() - loaded_at > 15:
                        waiting_hint_sent = True
                        vault.write_status('waiting', '登录页面已打开，但还没有检测到收藏请求。请在此窗口进入或刷新“我的收藏”，并保持窗口打开。')
                    continue
            if urlparse(window.get_current_url() or '').hostname != 'hsreplay.net':
                continue
            fallback_attempted = True
            processing = True
            try:
                cookie_map = {}
                expires_at = None
                headers = {key.lower(): value for key, value in candidate.get('headers', {}).items()}
                from_request = SimpleCookie()
                from_request.load(headers.get('cookie', ''))
                cookie_map.update({key: value.value for key, value in from_request.items()})
                for cookie in window.get_cookies():
                    for name, morsel in cookie.items():
                        domain = morsel['domain'].lstrip('.')
                        if domain == 'hsreplay.net' or domain.endswith('.hsreplay.net'):
                            cookie_map[name] = morsel.value
                            if name == 'sessionid':
                                max_age = morsel['max-age']
                                expires = morsel['expires']
                                try:
                                    if max_age:
                                        expires_at = datetime.now(timezone.utc).timestamp() + int(max_age)
                                    elif expires:
                                        expiry = parsedate_to_datetime(expires)
                                        if expiry.tzinfo is None:
                                            expiry = expiry.replace(tzinfo=timezone.utc)
                                        expires_at = expiry.timestamp()
                                except (TypeError, ValueError, OverflowError):
                                    expires_at = None
                if not cookie_map.get('sessionid'):
                    vault.write_status('error', '已识别国服账号，但登录窗口中没有会话 Cookie。请在此窗口完成登录后刷新“我的收藏”。')
                    continue
                account_name = (parse_account_name(candidate.get('accountLabel'))
                                or read_account_name())
                expires_at_iso = (datetime.fromtimestamp(expires_at, timezone.utc).isoformat()
                                  if expires_at is not None else None)
                vault.write_status('importing', '已识别国服账号，正在安全保存登录会话…', region=5)
                vault.save({'account': candidate['account'], 'region': candidate['region'],
                            'cookie': '; '.join(f'{name}={value}' for name, value in cookie_map.items()),
                            'userAgent': headers.get('user-agent') or window.evaluate_js('navigator.userAgent'),
                            'accountName': account_name, 'expiresAt': expires_at_iso,
                            'savedAt': datetime.now(timezone.utc).isoformat()})
                complete = True
                vault.write_status('connected', '国服账号已连接；可手动同步收藏，或下次启动应用时自动同步。',
                                   region=candidate['region'], accountName=account_name,
                                   expiresAt=expires_at_iso)
                stopped.set()
                window.destroy()
            except Exception:
                if not stopped.is_set():
                    vault.write_status('error', '检测到了国服收藏请求，但解析或保存失败；原有收藏已保留。请稍后重试。')
            finally:
                processing = False

    window.events.request_sent += request_sent
    window.events.loaded += on_loaded
    window.events.closed += on_closed
    try:
        webview.start(worker, private_mode=False, storage_path=str(data_dir / 'HSReplayProfile'), debug=False)
    except Exception:
        vault.write_status('error', '无法打开 HSReplay 登录窗口，请检查 WebView2 是否已安装。')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', required=True)
    run_login(Path(parser.parse_args().data_dir))

