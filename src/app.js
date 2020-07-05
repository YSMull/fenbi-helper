const Koa = require('koa');
const KoaRouter = require('koa-router');
const render = require('koa-ejs');

const path = require('path');

const app = new Koa();
const router = new KoaRouter();

const exerciseResult = require('./service/exercisesResult');

render(app, {
    root: path.join(__dirname, 'views'),
    layout: false,
    viewExt: 'ejs',
    cache: false,
    debug: false,
});


router.get('/exercise/:exerciseId', async ctx => {
    let exerciseId = ctx.params.exerciseId;
    let costThreshold = Number.parseInt(ctx.query.cost || 70);
    await ctx.render('exerciseResult', await exerciseResult.getResultObj(exerciseId, costThreshold));
});

router.get('/history', async ctx => {
    await ctx.render('history', await exerciseResult.getExerciseHistory());
});

router.post('/api/collect/:questionId', async ctx => {
    let questionId = ctx.params.questionId;
    await exerciseResult.addCollect(questionId);
    ctx.body = '';
});

router.del('/api/collect/:questionId', async ctx => {
    let questionId = ctx.params.questionId;
    await exerciseResult.delCollect(questionId);
    ctx.body = '';
});

router.get('/api/video/:questionId', async ctx => {
    let questionId = ctx.params.questionId;
    ctx.body = await exerciseResult.getVideoUrl(questionId);
})

router.all('/', async ctx => {
    ctx.redirect('/history');
})

app.use(router.routes()).use(router.allowedMethods())

app.use(async(ctx, next) => {
    if (ctx.status === 404) {
        ctx.redirect('/history');
    } else {
        next();
    }
});

app.listen(3000);