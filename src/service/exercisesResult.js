const _ = require('lodash');
const moment = require('moment');

const {httpRequest} = require('../util/httpUtil');
const {login} = require('../service/loginService');

let headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "accept-language": "zh-CN,zh-TW;q=0.9,zh;q=0.8",
    "cache-control": "max-age=0",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1"
};

async function getQuestionByIds(questionIds) {
    let questions = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/questions?ids=${questionIds.join(',')}`,
        method: "GET",
        json: true,
        headers
    });
    return _.zipObject(questions.map(q => q.id), questions)
}

async function getQuestionMetaByIds(questionIds) {
    let questions = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/question/meta?ids=${questionIds.join(',')}`,
        method: "GET",
        json: true,
        headers
    });
    return _.zipObject(questions.map(q => q.id), questions)
}

async function getQuestionKeyPointsByIds(questionIds) {
    let questions = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/solution/keypoints?ids=${questionIds.join(',')}`,
        method: "GET",
        json: true,
        headers
    });
    return _.zipObject(questionIds, questions);
}

// 返回收藏了的题目的id数组
async function getCollectsByIds(questionIds, cookie) {
    return await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/collects?ids=${questionIds.join(',')}`,
        method: "GET",
        json: true,
        headers: {
            ...headers,
            cookie
        }
    });
}

function getExerciseReport(exerciseId, cookie) {
    return httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/exercises/${exerciseId}/report/v2`,
        method: "GET",
        json: true,
        headers: {
            ...headers,
            cookie
        }
    });
}

function getExercise(exerciseId, cookie) {
    return httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/exercises/${exerciseId}`,
        method: "GET",
        json: true,
        headers: {
            ...headers,
            cookie
        }
    });
}

async function getExerciseHistory(categoryId, cookie) {
    let cursorArr = [0, 30];
    let hisArr = await Promise.all(cursorArr.map(cursor => {
        return httpRequest({
            url: `https://tiku.fenbi.com/api/xingce/category-exercises?categoryId=${categoryId}&cursor=${cursor}&count=30`,
            method: "GET",
            json: true,
            headers: {
                ...headers,
                cookie
            }
        });
    }));
    return _.flatMap(hisArr.filter(a => a), his => his.datas);
}

async function getSolutionsByIds(questionIds, cookie) {
    let questions = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/solutions?ids=${questionIds.join(',')}`,
        method: "GET",
        json: true,
        headers: {
            ...headers,
            cookie
        }
    });
    return _.zipObject(questionIds, questions);
}

async function getEpisodesByIds(questionIds, cookie) {
    let result = await httpRequest({
        url: `https://ke.fenbi.com/api/gwy/v3/episodes/tiku_episodes_with_multi_type?tiku_ids=${questionIds.join(',')}&tiku_prefix=xingce&tiku_type=5`,
        method: "GET",
        json: true,
        headers: {
            ...headers,
            cookie
        }
    });
    return result.data;
}

exports.getExerciseHistory = async function (cookie) {
    let result = await Promise.all([
        getExerciseHistory(1, cookie),
        getExerciseHistory(3, cookie)
    ]);
    let exerciseHistory = _.orderBy(_.flatMap(result, _.identity), ['updatedTime'], ['desc']);
    let exerciseReportMap = _.zipObject(exerciseHistory.map(item => item.id), await Promise.all(exerciseHistory.map(item => getExerciseReport(item.id, cookie))));
    exerciseHistory.forEach(history => {
        history.finishedTime = moment(history.updatedTime).format('YYYY-MM-DD HH:mm:ss')
        let report = exerciseReportMap[history.id];
        if (report) {
            history.elapsedTime = report.elapsedTime;
            history.answerCount = report.answerCount;
            history.correctRate = (report.correctCount / report.answerCount * 100).toFixed(1);
        }
    });
    exerciseHistory = exerciseHistory.filter(h => h.status === 1 && h.answerCount > 0);

    return {
        exerciseHistory: exerciseHistory.filter(h => h.status === 1),
        moment
    }
}

exports.getResultObj = async function (exerciseId, costThreshold, cookie) {
    let [exercise, report] = await Promise.all([getExercise(exerciseId, cookie), getExerciseReport(exerciseId, cookie)]);
    if (!report || !report.answers || !exercise) return;
    let collectionIds = await getCollectsByIds(report.answers.map(answer => answer.questionId), cookie);

    let answerResultMap = {};

    report.answers.forEach(answer => {
        // 只筛选出你做了的
        if (answer.status !== 10 || collectionIds.includes(answer.questionId)) {
            answerResultMap[answer.questionId] = answer.correct;
        }
    });

    let concernQuestions = Object.keys(answerResultMap).map(questionId => {
        let ua = Object.values(exercise.userAnswers).find(item => item.questionId == questionId);
        let correct = answerResultMap[questionId];
        return {
            idx: (ua && (ua.questionIndex + 1))  || report.answers.findIndex(item => item.questionId == questionId) + 1,
            questionId,
            correct,
            cost: ua && ua.time,
            myAnswer: (ua && ua.answer && ['A', 'B', 'C', 'D'][ua.answer.choice]) || '未选择'
        }
    }).filter(a => a);

    // let questionContentMap = await getQuestionByIds(concernQuestions.map(q => q.questionId));
    // let questionMetaMap = await getQuestionMetaByIds(concernQuestions.map(q => q.questionId));
    // let questionKeyPointsMap = await getQuestionKeyPointsByIds(concernQuestions.map(q => q.questionId));
    let solutionMap = await getSolutionsByIds(concernQuestions.map(q => q.questionId), cookie);

    concernQuestions = _.orderBy(concernQuestions, ['correct', 'cost', 'idx'], ['asc', 'desc', 'asc']);

    let concernSource = ['国家', '联考', '省', '市'];
    let concernSourceCountMap = {};
    concernQuestions.forEach(q => {
        let solutionObj = solutionMap[q.questionId];
        // 题干
        q.content = solutionObj.content; // html
        // 选项
        q.options = solutionObj.accessories[0].options;
        // 难度
        q.difficulty = solutionObj.difficulty;
        // 正确答案
        q.correctAnswer = solutionObj.correctAnswer;
        // 题目来源
        q.source = solutionObj.source;

        concernSource.some(item => {
            if (q.source.includes(item)) {
                concernSourceCountMap[item] = (concernSourceCountMap[item] || 0) + 1;
                return true;
            }
            return false;
        });

        q.hasCollect = collectionIds.some(qid => qid == q.questionId);

        q.keypoints = solutionObj.keypoints.map(i => i.name);
        q.tags = solutionObj.tags.map(i => i.name);

        // 答案解析
        q.solution = solutionObj.solution; // html

        q.mostWrongAnswer = solutionObj.questionMeta.mostWrongAnswer;

        q.correctRatio = solutionObj.questionMeta.correctRatio;

        q.totalCount = solutionObj.questionMeta.totalCount;

        if (solutionObj.note) {
            q.note = solutionObj.note.content;
        }

        if (solutionObj.material) {
            q.material = solutionObj.material.content;
        }
    });
    return {
        moment,
        exercise,
        costThreshold,
        concernSourceCount: Object.keys(concernSourceCountMap).map(key => ({key, count: concernSourceCountMap[key]})),
        concernQuestions
    }
}

exports.addCollect = async function (questionId, cookie) {
    return await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/collects/${questionId}`,
        method: "POST",
        headers: {
            ...headers,
            cookie
        },
        body: null
    });
}

exports.delCollect = async function (questionId, cookie) {
    await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/collects/${questionId}`,
        method: "DELETE",
        headers: {
            ...headers,
            cookie
        }
    });
}

exports.getVideoUrl = async function (questionId, cookie) {
    let episodeMap = await getEpisodesByIds([questionId]);
    if (episodeMap[questionId]) {
        let videoResult = await httpRequest({
            url: `https://ke.fenbi.com/api/gwy/v3/episodes/${episodeMap[questionId][0].id}/mediafile/meta`,
            method: "GET",
            headers: {
                ...headers,
                cookie
            },
            json: true
        });
        if (videoResult && videoResult.datas && videoResult.datas.length > 0) {
            return _.orderBy(videoResult.datas, ['realSize'], ['desc'])[0].url;
        } else {
            return null;
        }
    } else {
        return null;
    }
}

exports.getComments = async function (questionId, cookie) {
    try {
        let episodeMap = await getEpisodesByIds([questionId]);
        let cursorArr = [0, 30];
        let commentResultArr = await Promise.all(cursorArr.map(cursor => {
            return httpRequest({
                url: `https://ke.fenbi.com/ipad/gwy/v3/comments/episodes/${episodeMap[questionId][0].id}?system=12.4.7&inhouse=0&app=gwy&ua=iPad&av=44&version=6.11.3&kav=22&kav=1&len=30&start=${cursor}`,
                method: "GET",
                json: true,
                headers: {
                    ...headers,
                    cookie
                }
            });
        }));
        let datas = _.flatMap(commentResultArr.filter(a => a), r => r.datas);
        return _.orderBy(datas.filter(i => {
            return i.likeCount > 1 && !['?', '？'].some(t => i.comment.includes(t)) && i.comment.length > 8
        }), ['likeCount'], ['desc']).slice(0, 10);
    } catch (e) {
        return [];
    }
}

function convertTree(root) {
    let str = '';
    for (let child of root.children) {
        if (child.name === 'em') {
            str += '<span class="searchKeyword">' + convertTree(child) + '</span>';
        } else if (child.name === 'txt') {
            str += child.value;
        } else if (child.name === 'p') {
            str += convertTree(child);
        } else {
            console.log('b')
        }
    }
    return str;
}

exports.search = async function (text, cookie) {
    let cursorArr = [0, 15];
    let commentResultArr = await Promise.all(cursorArr.map(cursor => {
        return httpRequest({
            url: `https://60.205.108.139/ipad/search/v2?system=12.4.7&inhouse=0&app=gwy&ua=iPad&av=44&version=6.11.3&kav=22&coursePrefix=xingce&format=json&len=15&q=${encodeURIComponent(text)}&start=${cursor}`,
            method: "GET",
            json: true,
            headers: {
                ...headers,
                'User-Agent': 'XC/6.11.3 (iPad; iOS 12.4.7; Scale/2.00)',
                'Accept': '*/*',
                'Host': 'tiku.fenbi.com',
                cookie
            }
        });
    }));
    let datas = _.flatMap(commentResultArr.filter(a => a), r => _.get(r, 'data.items', []));

    datas.forEach(item => {
        let sourceList = item.source.split(',');
        item.sourceList = sourceList.filter(s => {
            let blockSourceList = ['礼包', '模考'];
            return !blockSourceList.some(b => s.includes(b));
        })
    });
    datas = datas.filter(item => item.sourceList.length !== 0);
    datas.forEach(item => {
        item.stemSnippet_ = convertTree(JSON.parse(item.stemSnippet));
    });
    return datas;
}