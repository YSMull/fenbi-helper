const Koa = require('koa');
const KoaRouter = require('koa-router');
const koaBody = require('koa-body');

const render = require('koa-ejs');

const path = require('path');
const qs = require('qs');
const url = require('url');

const app = new Koa();
const router = new KoaRouter();

const exerciseResult = require('./service/exercisesResult');
const loginService = require('./service/loginService');

render(app, {
    root: path.join(__dirname, 'views'),
    layout: false,
    viewExt: 'ejs',
    cache: false,
    debug: false,
});

app.use(router.routes()).use(router.allowedMethods())

app.use(koaBody())

app.use(async(ctx, next) => {
    if (ctx.status === 404) {
        ctx.redirect('/history');
    } else {
        next();
    }
});

app.listen(3000);


router.get('/exercise/:exerciseId', async ctx => {
    let exerciseId = ctx.params.exerciseId;
    let costThreshold = Number.parseInt(ctx.query.cost || 70);
    let cookie = ctx.request.headers['cookie']
    let renderObj = await exerciseResult.getResultObj(exerciseId, costThreshold, cookie);
    if (renderObj) {
        await ctx.render('exerciseResult', renderObj);
    } else {
        ctx.redirect('/setup?redirectPath=' + ctx.originalUrl);
    }

});

router.get('/history', async ctx => {
    let cookie = ctx.request.headers['cookie']
    await ctx.render('history', await exerciseResult.getExerciseHistory(cookie));
});

router.get('/setup', async ctx => {
    await ctx.render('setup', {});
});

router.post('/api/login',  koaBody(), async ctx => {
    let {phone, password, captcha} = ctx.request.body;
    let cookies = await loginService.login(phone, password, captcha);
    if (cookies.length > 1) {
        cookies.forEach(cookie => {
            let {name, value} = cookie;
            ctx.cookies.set(name, value, {
                path: '/',   //cookie写入的路径
                maxAge: 0,
                expires: new Date('2099-07-06'),
                httpOnly: false
            });
            let referer = ctx.request.headers.referer;
            let redirectPath = qs.parse(url.parse(referer).query)['redirectPath'] || '/history';
            ctx.body = {
                code: 200,
                redirectPath
            };
        });
    } else {
        ctx.body = {
            code: 500
        };
    }
});

router.post('/api/collect/:questionId', async ctx => {
    let questionId = ctx.params.questionId;
    let cookie = ctx.request.headers['cookie']
    await exerciseResult.addCollect(questionId, cookie);
    ctx.body = '';
});

router.del('/api/collect/:questionId', async ctx => {
    let questionId = ctx.params.questionId;
    let cookie = ctx.request.headers['cookie']
    await exerciseResult.delCollect(questionId, cookie);
    ctx.body = '';
});

router.get('/api/video/:questionId', async ctx => {
    let questionId = ctx.params.questionId;
    let cookie = ctx.request.headers['cookie']
    ctx.body = await exerciseResult.getVideoUrl(questionId, cookie);
})

router.all('/', async ctx => {
    ctx.redirect('/history');
})