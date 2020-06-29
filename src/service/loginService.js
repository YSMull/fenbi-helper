const request = require('request');

let loginBody = 'phone=18565618629&password=n1%2BShg0XuAa%2BMsUP3pRH1upYz8vv29ZGvaBhs%2BPyIZufnM6j%2FaFPyxp1XTjh4OQpribA8e4kiGMeCfHr%2Fr%2FMQCQimCiSDvA2Bqm%2BOpuzudlJafZL7jF1A2UyWlIDUWjgUQRDuNzIYyq9lxEzcd4CbNMxQtfz%2BPAxag5MrWy5D4A%3D';

exports.login = async function () {
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
            resolve(httpResponse.headers['set-cookie'].join(';'));
        });
    });
}