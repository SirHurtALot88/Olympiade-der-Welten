import os, sys
S = os.path.dirname(os.path.abspath(__file__)); REPO = sys.argv[1]
t = open(S + '/tpl.html').read(); d = open(S + '/data.json').read()
assert t.count('__DATA__') == 1
out = REPO + '/public/mockups/saisonstand-modern-17-11.html'
open(out, 'w').write(t.replace('__DATA__', d))
print(out, os.path.getsize(out))
