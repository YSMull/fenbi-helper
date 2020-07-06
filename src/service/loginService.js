const request = require('request');
const setCookie = require('set-cookie-parser');


/**
 * 返回的是 Cookie
 */
exports.login = async function (phone, password, captcha) {
    let loginBody = `phone=${phone}&password=${password}`;
    if (captcha != null && captcha !== '') {
        loginBody += `&captcha=${captcha}`;
    }
    return await new Promise(function (resolve, reject) {
        request({
            url: 'https://tiku.fenbi.com/api/users/loginV2',
            method: 'POST',
            json: true,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: loginBody,
        }, function (err, httpResponse, body) {
            if (err) reject(err);
            resolve(setCookie.parse(httpResponse.headers['set-cookie']));
        });
    });
}