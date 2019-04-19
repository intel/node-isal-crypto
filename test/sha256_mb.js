module.exports = function test_sha256_mb(isal) {

const sha256_mb = isal.sha256_mb;
const assert = require('assert');
const context_manager = new ArrayBuffer(sha256_mb.sizeof_SHA256_HASH_CTX_MGR);
const input = 'The quick brown fox jumped over the lazy dog.';
const expected = '68b1282b91de2c054c36629cb8dd447f12f096d3e3c587978dc2248444633483';

// Conversion copied from:
// https://stackoverflow.com/questions/17191945/conversion-between-utf-8-arraybuffer-and-string#answer-17192845
function stringToUint(string) {
    var string = unescape(encodeURIComponent(string)),
        charList = string.split(''),
        uintArray = [];
    for (var i = 0; i < charList.length; i++) {
        uintArray.push(charList[i].charCodeAt(0));
    }
    return new Uint8Array(uintArray);
}

sha256_mb.sha256_ctx_mgr_init(context_manager);
let context = new ArrayBuffer(sha256_mb.sizeof_SHA256_HASH_CTX);
sha256_mb.hash_ctx_init(context);
// let resulting_context = sha256_mb.sha256_ctx_mgr_submit(context_manager,
//   context, stringToUint(input).buffer, 
};
