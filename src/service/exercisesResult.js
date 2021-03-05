const _ = require('lodash');
const moment = require('moment');
const qs = require('querystring');
const percentile = require('percentile');

const {httpRequest} = require('../util/httpUtil');

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

async function getCategories(group, cookie) {
    let category = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/categories?&filter=keypoint&app=web&kav=12&version=3.0.0.0`,
        method: "GET",
        json: true,
        headers: {
            ...headers,
            cookie
        }
    });
    let rels = [];
    buildCat(category, rels, group);

    rels.push({type: '试卷', items: group['others'].filter(i => i.answerCount > 30), childTypes: []});

    calcCount(rels);
    return rels;
}

function buildCat(cats, roots, group) {
    if (!cats || cats.length === 0) return;
    for (let cat of cats) {
        let name = cat.name.split('-')[0];
        let obj = {
            type: name,
            childTypes: [],
            items: [],
        };
        buildCat(cat.children, obj.childTypes, group);
        if (!roots.map(i => i.type).includes(name)) {
            obj.items = group[name] || []
            roots.push(obj);
        }
    }
}

function sum (arr) {
    return arr.reduce((a, b) => a + b, 0)
}

function _buildCount(root) {
    if (!root) return 0;
    let count = sum(root.items.map(i => i.answerCount)) + sum(root.childTypes.map(t => _buildCount(t)));
    root.count = count;
    return count;
}

function calcCount(roots) {
    if (!roots || roots.length === 0) return;
    for (let root of roots) {
        _buildCount(root);
    }
}

let cleanTitle = function (title) {
    if (!title) return "无来源";
    return title.replace(/辽宁\/湖南\/湖北\/安徽\/四川\/福建\/云南\/黑龙江\/江西\/广西\/贵州\/海南\/内蒙古\/山西\/重庆\/宁夏\/西藏/g, '湖北')
        .replace(/山西\/辽宁\/黑龙江\/福建\/湖北\/ 湖南\/广西\/海南\/四川\/重庆\/ 云南\/ 西藏\/陕西\/青海\/宁夏\/ 新疆兵团/g, '湖北')
        .replace(/贵州\/四川\/福建\/黑龙江\/湖北\/山西\/重庆\/辽宁\/海南\/江西\/天津\/陕西\/云南\/广西\/山东\/湖南/g, '湖北')
        .replace(/（网友回忆版）/g, '')
        .replace(/网友回忆版/g, '')
        .replace(/第\d+题/g, '')
        .replace(/县级\+乡镇/g, '县级');
}

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

function parseWordListFromNote(content) {
    let lines = content.split('\n');
    let s = lines.indexOf('[start积累]');
    let e = lines.indexOf('[end积累]');
    if (s !== -1 && e !== -1) {
        lines = lines.slice(s+1, e).filter(a => a);
        let wdList = lines.map(wl => {
            let w = wl.replace(/.*\* \[?([^\]]*)\]?\[?[^\[\]]*\]?[：|:].*/g, '$1')
            return w;
        });
        return wdList.filter(a => a.length <= 5);
    } else {
        return [];
    }
}

function parseTagListFromNote(content) {
    let lines = content.split('\n').filter(a => a);
    let wdList = lines.map(wl => {
        if (wl.match(/^\{(.*)\}$/g)) {
            let w = wl.replace(/^\{(.*)\}$/g, '$1')
            return w;
        }
    }).filter(a => a);
    return wdList;
}

exports.zjWord = async function (word) {
    let result = await httpRequest({
        url: `https://zaojv.com/wordQueryDo.php`,
        method: "POST",
        headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: qs.stringify({
            nsid: 0,
            s: 45957424262910633321,
            wo: word,
            directGo: 1
        })
    });
    return "https://zaojv.com/" + result.replaceAll("\n", "").replace(/(.*)HREF="(.*)".*/g, '$2')
}

exports.saveNote = async function (questionId, content, cookie) {
    let result = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/notes`,
        method: "POST",
        headers: {
            ...headers,
            'Content-Type': 'application/json;charset=UTF-8',
            cookie
        },
        body: JSON.stringify({
            content,
            questionId: Number.parseInt(questionId)
        })
    });
    if (!result) {
        throw new Error('save note error!')
    }
    return result;
}

let getNotesMapByIds = async function (questionIds, cookie) {
    let params = qs.stringify({
        questionIds: questionIds.join(',')
    })
    let result = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/notes?` + params,
        method: "GET",
        headers: {
            ...headers,
            'Content-Type': 'application/json;charset=UTF-8',
            cookie
        },
        json: true,
    });
    result = result.filter(a => a);

    return _.zipObject(result.map(r => r.questionId), result.map(r => r.content));
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
        history.finishedDate = moment(history.updatedTime).format('YYYY-MM-DD')
        let report = exerciseReportMap[history.id];
        if (report) {
            history.elapsedTime = report.elapsedTime;
            history.answerCount = report.answerCount;
            history.correctRate = (report.correctCount / report.answerCount * 100).toFixed(1);
        }
    });
    exerciseHistory = exerciseHistory.filter(h => h.status === 1 && h.answerCount > 0);
    let exerciseHistoryGroup = _.groupBy(exerciseHistory, h => {
        let name = h.sheet.name || '';
        if (name.startsWith('专项智能练习')) {
            h.cleanName = name.replace(/(专项智能练习)（(.*)）/, '$1');
            return name.replace(/专项智能练习（(.*)）/, '$1');
        } else {
            h.cleanName = cleanTitle(name);
            return 'others';
        }
    });

    let groupItems = await getCategories(exerciseHistoryGroup, cookie);

    let exerciseHeatMapData = {};

    // let dayTime = 3600 * 24 * 1000;
    // let start = +moment().startOf('day').subtract(1, 'year').toDate();
    // let end = +moment().startOf('day').toDate();
    // for (let time = start; time < end; time += dayTime) {
    //     exerciseHeatMapData[time / 1000] = 0;
    // }
    exerciseHistory.forEach(h => {
        let v = moment(h.finishedDate).toDate().getTime() / 1000;
        exerciseHeatMapData[v] = (exerciseHeatMapData[v] || 0) + h.answerCount;
    });

    return {
        groupItems,
        exerciseHeatMapData,
        exerciseHistoryGroup,
        exerciseHistory,
        cleanTitle,
        moment
    }
}

exports.getQuestion = async function (questionId, cookie) {
    let solutionMap = await getSolutionsByIds([questionId], cookie);
    let notesMap = await getNotesMapByIds([questionId], cookie);
    let collectionIds = await getCollectsByIds([questionId], cookie);
    let q = solutionMap[questionId];
    if (notesMap[questionId]) {
        q.note = notesMap[questionId];
        q.wordList = parseWordListFromNote(q.note);
    }

    q.hasCollect = collectionIds.some(qid => qid === q.id);

    q.keypoints = q.keypoints ? q.keypoints.map(i => i.name) : [];

    q.mostWrongAnswer = q.questionMeta.mostWrongAnswer;

    q.correctRatio = q.questionMeta.correctRatio;

    q.totalCount = q.questionMeta.totalCount;

    q.options = q.accessories[0].options;

    if (q.material) {
        q.material = q.material.content;
    }
    return {
        q,
    }
};

exports.getResultObj = async function (exerciseId, costThreshold, cookie) {
    let [exercise, report] = await Promise.all([getExercise(exerciseId, cookie), getExerciseReport(exerciseId, cookie)]);
    if (!report || !report.answers || !exercise) return;
    let collectionIds = await getCollectsByIds(report.answers.map(answer => answer.questionId), cookie);

    let answerResultMap = {};

    report.answers.forEach(answer => {
        // 只筛选出你做了的
        // todo: 这里判断下，收藏的题的idx是否在你做了的题的idx的range里
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
    let notesMap = await getNotesMapByIds(concernQuestions.map(q => q.questionId), cookie);

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
            if (q.source && q.source.includes(item)) {
                concernSourceCountMap[item] = (concernSourceCountMap[item] || 0) + 1;
                return true;
            }
            return false;
        });

        q.hasCollect = collectionIds.some(qid => qid == q.questionId);

        q.keypoints = solutionObj.keypoints ? solutionObj.keypoints.map(i => i.name) : [];
        q.tags = solutionObj.tags.map(i => i.name);

        // 答案解析
        q.solution = solutionObj.solution; // html

        q.mostWrongAnswer = solutionObj.questionMeta.mostWrongAnswer;

        q.correctRatio = solutionObj.questionMeta.correctRatio;

        q.totalCount = solutionObj.questionMeta.totalCount;

        if (notesMap[q.questionId]) {
            q.note = notesMap[q.questionId];
            q.wordList = parseWordListFromNote(q.note);
            q.tagList = parseTagListFromNote(q.note);
        }

        if (solutionObj.material) {
            q.material = solutionObj.material.content;
        }
    });

    let costArr = concernQuestions.map(a => ({idx: a.idx, cost: a.cost, correctRatio: a.correctRatio})).filter(a => a.cost);
    // let mean = _.sum(costArr) / costArr.length;
    // let var1 = Math.sqrt(_.sum(costArr.map(i => (i - mean) * (i - mean))) / costArr.length);
    // let var2 = Math.sqrt(_.sum(costArr.map(i => (i - mean) * (i - mean))) / (costArr.length - 1));

    return {
        moment,
        exercise,
        cleanTitle,
        costThreshold,
        concernSourceCount: Object.keys(concernSourceCountMap).map(key => ({key, count: concernSourceCountMap[key]})),
        concernQuestions,
        costArr: _.orderBy(costArr, ['idx'], ['asc']),
        percentile,
        avg: arr => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length,
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