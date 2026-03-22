cd ~/Desktop/project/wyc-backend
echo "=== Security Checklist ==="
grep "^SESSION_SECRET=" .env | awk -F'=' '{print "SESSION_SECRET: " length($2) " chars"}'
grep "^ADMIN_TOKEN=" .env | awk -F'=' '{print "ADMIN_TOKEN: " length($2) " chars"}'
[ -f .gitignore ] && echo "✅ .gitignore exists" || echo "❌ .gitignore MISSING"
grep -q "^\.env$" .gitignore && echo "✅ .env protected" || echo "❌ .env NOT protected"
grep -q "^data/$" .gitignore && echo "✅ Database protected" || echo "❌ Database NOT protected"
[ -d data/backups ] && echo "✅ Backups folder exists" || echo "❌ Backups MISSING"
[ -f backup.sh ] && echo "✅ backup.sh exists" || echo "❌ backup.sh MISSING"
grep -q "CHANGE_ME" .env && echo "❌ CHANGE_ME found!" || echo "✅ No placeholders"
echo "=== Done ==="
