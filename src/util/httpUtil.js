const request = require('request')

const ERR_CODE = 666;

exports.httpRequest = async function (params) {
    try {
        return await new Promise(function (resolve, reject) {
            request(params, function (err, httpResponse, body) {
                if (err) reject(err);
                resolve(body);
            });
        });
    } catch (error) {
        if (error.code === 'ETIMEDOUT') {
            throw {
                code: 'ERR_CODE',
                message: `请求${params.url}服务超时`,
                value: JSON.stringify(error),
            };
        }
        if (error.connect === true) {
            throw {
                code: ERR_CODE,
                message: `无法连接${params.url}服务`,
                value: JSON.stringify(error),
            };
        }
        throw {
            code: ERR_CODE,
            message: `请求${params.url}服务出错`,
            value: JSON.stringify(error),
        };
    }
};