#!/bin/bash
echo "Setting up shadow server..."
cp server.js server_test.js
sed -i 's/const PORT = process.env.PORT || 3001;/const PORT = 3002;/g' server_test.js
# Inject a middleware to fake authentication
sed -i '/const app = express();/a \
app.use((req, res, next) => { req.user = { id: "test_user_123" }; req.isAuthenticated = () => true; next(); }); \
' server_test.js

pm2 start server_test.js --name shadow-api > /dev/null

echo "Waiting for server to start..."
sleep 2

touch dummy.jpg
echo "fake image data" > dummy.jpg

echo ""
echo "=== TEST: STANDARD APPLICATION ==="
curl -s -X POST http://localhost:3002/api/generate/package-draft \
  -F 'payload={"action":"initial","visaType":"F4","givenNames":"TEST","surname":"USER"}' \
  -F 'passport=@dummy.jpg' \
  -F 'idCard=@dummy.jpg' \
  -F 'contract=@dummy.jpg' \
  -F 'signature=@dummy.jpg' > res.json

PKG_ID=$(cat res.json | grep -o '"id":"[^"]*"' | head -n 1 | cut -d'"' -f4)
echo "Draft Package ID: $PKG_ID"

curl -s -X POST http://localhost:3002/api/generate/package-download \
  -F "payload={\"action\":\"initial\",\"visaType\":\"F4\",\"givenNames\":\"TEST\",\"surname\":\"USER\",\"packageId\":\"$PKG_ID\"}" \
  -F 'passport=@dummy.jpg' \
  -F 'idCard=@dummy.jpg' \
  -F 'contract=@dummy.jpg' \
  -F 'signature=@dummy.jpg' -o test_std.pdf

echo "Uploaded Files inside data/uploads/$PKG_ID :"
ls -la data/uploads/$PKG_ID | awk '{print $9}' | grep -v '^\s*$' || echo "(no files)"
echo "Checking if test_std.pdf contains scans (size difference):"
ls -la test_std.pdf | awk '{print $5}'

echo ""
echo "=== TEST: PASSWORD RECOVERY ==="
curl -s -X POST http://localhost:3002/api/generate/package-draft \
  -F 'payload={"action":"password_recovery","givenNames":"TEST","surname":"USER"}' \
  -F 'idCard=@dummy.jpg' \
  -F 'idCardBack=@dummy.jpg' \
  -F 'signature=@dummy.jpg' > res2.json

PKG_ID2=$(cat res2.json | grep -o '"id":"[^"]*"' | head -n 1 | cut -d'"' -f4)
echo "Draft Package ID: $PKG_ID2"

curl -s -X POST http://localhost:3002/api/generate/package-download \
  -F "payload={\"action\":\"password_recovery\",\"givenNames\":\"TEST\",\"surname\":\"USER\",\"packageId\":\"$PKG_ID2\"}" \
  -F 'idCard=@dummy.jpg' \
  -F 'idCardBack=@dummy.jpg' \
  -F 'signature=@dummy.jpg' -o test_pwd.pdf

echo "Uploaded Files inside data/uploads/$PKG_ID2 :"
ls -la data/uploads/$PKG_ID2 | awk '{print $9}' | grep -v '^\s*$' || echo "(no files)"

echo ""
echo "Cleaning up..."
pm2 delete shadow-api > /dev/null
rm server_test.js dummy.jpg res.json res2.json test_std.pdf test_pwd.pdf test_script2.sh
echo "Done."
