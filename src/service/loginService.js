const request = require('request');
const setCookie = require('set-cookie-parser');


function queryString(n) {
    var t = "";
    for (let e in n)
        t += e + "=" + encodeURIComponent(n[e]) + "&";
    return t.slice(0, -1)
}

/**
 * 返回的是 Cookie
 */
exports.login = async function (phone, password, captcha) {
    let loginBody = {
        phone,
        password
    };
    if (captcha != null && captcha !== '') {
        loginBody.captcha = captcha;
    }

    return await new Promise(function (resolve, reject) {
        request({
            url: 'https://tiku.fenbi.com/api/users/loginV2',
            method: 'POST',
            json: true,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: queryString(loginBody),
        }, function (err, httpResponse, body) {
            if (err) reject(err);
            resolve(setCookie.parse(httpResponse.headers['set-cookie']));
        });
    });
}