const Koa = require('koa');
const KoaRouter = require('koa-router');
const koaBody = require('koa-body');

const render = require('koa-ejs');

const path = require('path');

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
    await ctx.render('exerciseResult', await exerciseResult.getResultObj(exerciseId, costThreshold, cookie));
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
    let cookie = await loginService.login(phone, password, captcha);
    ctx.body = cookie;
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