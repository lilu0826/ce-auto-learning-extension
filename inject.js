const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const div = document.createElement("div");
document.body.appendChild(div);

async function getStudyConfig() {
    const res = await axios.get(
        "https://www.cdsjxjy.cn/prod/stu/student/study/config/get"
    );
    return res.data.data;
}

async function getCourseDatasts() {
    const res = await axios.post(
        "https://www.cdsjxjy.cn/prod/stu/student/course/page/datasts",
        {}
    );
    return res.data.data;
}

//获取全部课程列表
async function getCourseList() {
    const { TotalCount } = await getCourseDatasts();
    const res = await axios.post(
        "https://www.cdsjxjy.cn/prod/stu/student/course/page/selected",
        {
            pageNum: 1,
            pageSize: TotalCount,
        }
    );
    return res.data.data.content;
}

//开始学习获取课程信息
async function startCourse(selectId) {
    const res = await axios.post(
        "https://www.cdsjxjy.cn/prod/stu/student/course/study/start",
        {
            selectId,
        }
    );
    const { hasOther, sessionId } = res.data.data;
    if (hasOther) {
        //结束其他课程
        await endCourse(sessionId);
        //开始新课程
        return startCourse(selectId);
    }
    return res.data.data;
}

//结束之前得学习
async function endCourse(sessionId) {
    const res = await axios.post(
        "https://www.cdsjxjy.cn/prod/stu/student/course/study/end",
        {
            sessionId,
        }
    );
    return res.data.code == 200;
}

// 跟踪学习记录（发送心跳）
async function trackCourse(sessionId) {
    const res = await axios.post(
        "https://www.cdsjxjy.cn/prod/stu/student/course/study/heartbeat",
        {
            sessionId,
        }
    );
    return res.data.data;
}

//发送验证码
async function verifyCourse(sessionId, verifyCode) {
    const res = await axios.post(
        "https://www.cdsjxjy.cn/prod/stu/student/course/study/verify",
        {
            sessionId,
            verifyCode,
        }
    );
    return res.data.code == 200;
}

// 添加学习记录
async function addRecord(selectId,content="好") {
    const res = await axios.post(
        "https://www.cdsjxjy.cn/prod/stu/learning/record",
        {
            selectId,
            feeling: content,
            courseContent: content,
        }
    );
    return res.data.code == 200;
}

if (window.Vue) {
    const app = new Vue({
        el: div,
        data() {
            return {
                title:"自动学习中...请保持窗口不关闭",
                gridData: [],
                dialogTableVisible: false,
                style: {
                    position: "fixed",
                    top: "109px",
                    right: "37px",
                    margin: "auto",
                    background: "white",
                    padding: "10px",
                    height: "fit-content",
                    width: "fit-content",
                    zIndex: "10",
                },
                show: false,
            };
        },
        template: `
            <div :style="style" v-if="show">
                <el-button type="primary" @click="dialogTableVisible = true">开始自动学习</el-button>
                <el-dialog append-to-body @closed="handleClose" @opened="handleStart" :title="title" :visible.sync="dialogTableVisible">
                    <el-table :data="gridData">
                        <el-table-column property="courseName" show-overflow-tooltip label="课程名"></el-table-column>
                        <el-table-column property="courseName" label="进度">
                            <template slot-scope="scope">
                                <el-progress style="white-space: nowrap" :percentage="(scope.row.duration / scope.row.requiredTime * 100).toFixed(2)"></el-progress>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-dialog>
            </div>
        `,
        methods: {
            async study() {
                const config = await getStudyConfig();
                const courseList = await getCourseList();
                this.gridData = courseList;
                for (const course of courseList) {
                    const { selectId, requiredTime } = course;
                    const { sessionId, recordFinished, watchingFinished } =
                        await startCourse(selectId);
                    if (!recordFinished) {
                        // 添加学习记录
                        addRecord(selectId,course.courseName);
                    }
                    if (!watchingFinished) {
                        //跟踪学习记录
                        while (true) {
                            const {
                                creditObtained,
                                verifyCode,
                                watchingFinished,
                                duration,
                            } = await trackCourse(sessionId);
                            course.duration = duration;
                            if (
                                creditObtained ||
                                watchingFinished ||
                                duration >= requiredTime
                            ) {
                                //学分获得
                                break;
                            }
                            if (verifyCode) {
                                //发送验证码
                                await verifyCourse(sessionId, verifyCode);
                            }
                            await delay(1000 * config.interval);
                        }
                    }
                    if (sessionId) {
                        //学习完了直接结束掉当前课程
                        await endCourse(sessionId);
                    }

                    //更新课程统计信息
                    await getCourseDatasts();
                }
            },
            handleStart() {
                (async () => {
                    while (true) {
                        try {
                            await this.study();
                            console.log("学习完成");
                            this.title = "学习完成,请关闭窗口。";
                            break;
                        } catch (error) {
                            if (error.message == "canceled") {
                                console.log("学习取消");
                                break;
                            }
                            console.log("学习出错，正在重试！", error.message);
                            await delay(5000);
                        }
                    }
                })();
            },
            handleClose() {
                window.location.reload();
            },
        },
    });

    function show() {
        if (location.hash.includes("onlineLearn/myLearn")) {
            app.show = true;
        } else {
            app.show = false;
        }
    }
    show();
    setInterval(() => {
        show();
    }, 1000);
}
