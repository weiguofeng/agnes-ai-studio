import urllib.request, urllib.error, json, base64, time

API_KEY = 'sk-vlSFFyGrvjPlPiLjPd1ebMeBFv36BX3cxrKbeSfh16VpMhS6'
BASE_URL = 'https://apihub.agnes-ai.com/v1'

def api_request(method, path, data=None):
    url = BASE_URL + '/' + path
    headers = {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json',
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print('  HTTP %d: %s' % (e.code, err_body[:200]))
        raise

# === TEST 1: TEXT-TO-VIDEO ===
print('=== Test 1: Text-to-Video ===')
task1 = api_request('POST', 'videos', {
    'model': 'agnes-video-v2.0',
    'prompt': 'A calm ocean wave gently rolling onto a sandy beach at sunset with golden colors',
    'height': 768, 'width': 1152,
    'num_frames': 25, 'frame_rate': 24,
})
t1_id = task1.get('task_id') or task1.get('id')
print('  Task: ' + str(t1_id))
print('  Status: ' + str(task1.get('status')))

# === TEST 2: IMAGE-TO-VIDEO ===
print('\n=== Test 2: Image-to-Video ===')
with open(r'C:\Users\Lenovo\Documents\Agnes-request\agnes-creator\tests\helpers\test_image.b64', 'r') as f:
    test_image = f.read().strip()
print('  Image: %d chars b64, %d bytes decoded' % (len(test_image), len(base64.b64decode(test_image))))

task2 = api_request('POST', 'videos', {
    'model': 'agnes-video-v2.0',
    'prompt': 'Animate this colorful gradient scene with gentle motion',
    'image': test_image,
    'height': 768, 'width': 1152,
    'num_frames': 25, 'frame_rate': 24,
})
t2_id = task2.get('task_id') or task2.get('id')
print('  Task: ' + str(t2_id))
print('  Status: ' + str(task2.get('status')))

# === POLLING ===
print('\n=== Polling ===')
results = {}
for label, tid in [('Text-to-Video', t1_id), ('Image-to-Video', t2_id)]:
    print('\nPolling %s (%s...):' % (label, str(tid)[:20]))
    start = time.time()
    last_status = ''
    timeout = 600
    while time.time() - start < timeout:
        try:
            sd = api_request('GET', 'videos/%s' % tid)
            st = sd.get('status', 'queued')
            pg = sd.get('progress', 0)
            vu = sd.get('remixed_from_video_id', '')
            el = int(time.time() - start)
            if st != last_status:
                print('  [%ds] status=%s progress=%d%%' % (el, st, pg))
                last_status = st
            if st == 'completed':
                print('  ✅ COMPLETED in %ds' % el)
                print('  URL: ' + str(vu))
                results[label] = {'status': 'completed', 'url': vu, 'time': el}
                break
            elif st == 'failed':
                err = str(sd.get('error', 'unknown'))
                print('  ❌ FAILED in %ds: %s' % (el, err[:100]))
                results[label] = {'status': 'failed', 'error': err}
                break
        except Exception as e:
            print('  ⚠️  Poll error: ' + str(e))
        time.sleep(10)
    else:
        print('  ⏰ TIMEOUT after %ds' % timeout)
        results[label] = {'status': 'timeout'}

# === SUMMARY ===
print('\n' + '=' * 60)
print('PIPELINE TEST RESULTS')
print('=' * 60)
all_passed = True
for label, r in results.items():
    ok = r.get('status') == 'completed'
    emoji = '✅' if ok else '❌'
    print('%s %s: %s' % (emoji, label, r.get('status')))
    if 'time' in r:
        print('   Latency: %ds' % r['time'])
    if 'url' in r:
        print('   URL: ' + r['url'])
    if 'error' in r:
        print('   Error: ' + str(r['error'])[:100])
    if not ok:
        all_passed = False

print()
if all_passed:
    print('✅ ALL PIPELINES PASSED')
else:
    print('❌ SOME PIPELINES FAILED')

with open(r'C:\Users\Lenovo\Documents\Agnes-request\agnes-creator\tests\reports\pipeline_results.json', 'w') as f:
    json.dump(results, f, indent=2)
print('\nResults saved to tests/reports/pipeline_results.json')