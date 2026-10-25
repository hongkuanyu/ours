const crypto = require('node:crypto')
const passphrase = '5201314'
const text = `如果你打开了这页，说明我们之间又多了一个只有两个人知道的秘密。

其实我没有准备什么惊天动地的话。我只是想告诉你，和你在一起之后，我开始认真期待很多以前不会留意的东西：第二天的天气、下一次见面、你随口说过想去的地方，还有我们还没拍完的那些照片。

这页会一直在这里。等我们走得再远一点，就回来看看今天的我们。

谢谢你愿意成为我的例外。`
const salt = crypto.randomBytes(16)
const iv = crypto.randomBytes(12)
const key = crypto.pbkdf2Sync(passphrase, salt, 210000, 32, 'sha256')
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final(), cipher.getAuthTag()])
console.log(JSON.stringify({ salt: salt.toString('base64'), iv: iv.toString('base64'), ciphertext: encrypted.toString('base64') }))
