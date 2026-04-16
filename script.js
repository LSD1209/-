let currentTab = 'leave-tab';

// 1. 탭 전환 기능
function openTab(t) {
    currentTab = t;
    document.getElementById('date-inputs').style.display = t === 'leave-tab' ? 'block' : 'none';
    document.getElementById('money-inputs').style.display = t === 'money-tab' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach((b, i) => {
        b.classList.toggle('active', (i === 0 && t === 'leave-tab') || (i === 1 && t === 'money-tab'));
    });
}

// 2. 수당 항목 추가 기능
function addAllowanceField() {
    const list = document.getElementById('allowance-list');
    const row = document.createElement('div');
    row.className = 'allowance-row';
    row.innerHTML = `
        <input type="text" placeholder="수당명(식대 등)" style="width:55%">
        <input type="number" placeholder="금액" class="allowance-value" style="width:30%">
        <button class="remove-btn" onclick="this.parentElement.remove()" style="background:#ff4d4d; color:white; border:none; border-radius:5px; cursor:pointer;">×</button>
    `;
    list.appendChild(row);
}

// 3. 메인 계산 실행 함수
function mainCalculate() {
    document.getElementById('welcome-msg').style.display = 'none';
    if(currentTab === 'leave-tab') {
        document.getElementById('leave-report').style.display = 'block';
        document.getElementById('money-report').style.display = 'none';
        calculateLeave();
    } else {
        document.getElementById('leave-report').style.display = 'none';
        document.getElementById('money-report').style.display = 'block';
        calculateMoney();
    }
}

// 4. 연차 수당 계산 로직
function calculateMoney() {
    const base = Number(document.getElementById('base-salary').value) || 0;
    const days = Number(document.getElementById('unused-days').value) || 0;
    let adds = 0;
    document.querySelectorAll('.allowance-value').forEach(i => adds += Number(i.value) || 0);
    
    const totalOrdinaryWage = base + adds;
    const hourlyPay = totalOrdinaryWage / 209;
    const dailyPay = hourlyPay * 8;
    const finalMoney = dailyPay * days;

    const tbody = document.querySelector('#money-result-table tbody');
    tbody.innerHTML = `
        <tr><td>총 통상월급</td><td>기본급 + 수당 합계</td><td>${totalOrdinaryWage.toLocaleString()} 원</td></tr>
        <tr><td>통상 시급</td><td>총액 / 209시간</td><td>${Math.floor(hourlyPay).toLocaleString()} 원</td></tr>
        <tr><td>1일 통상임금</td><td>시급 × 8시간</td><td>${Math.floor(dailyPay).toLocaleString()} 원</td></tr>
        <tr style="background:#f3ebff; font-weight:bold; color:#764ba2;">
            <td>최종 수당 예상액</td>
            <td>미사용 ${days}일분</td>
            <td>${Math.floor(finalMoney).toLocaleString()} 원</td>
        </tr>
    `;
}

// 5. 연차 발생 계산 로직 (법 개정 반영)
const LAW_CHANGE_DATE = new Date('2017-05-30'); // 개정법 적용 기준일 (2017.05.30 입사자부터)

function calculateLeave() {
    const joinInput = document.getElementById('join-date').value;
    const exitInput = document.getElementById('exit-date').value;
    if(!joinInput || !exitInput) { alert("날짜를 입력해주세요!"); return; }

    const join = new Date(joinInput);
    const exit = new Date(exitInput);
    
    renderJoinBasis(join, exit);
    renderAccountingBasis(join, exit);
}

// [입사일 기준]
function renderJoinBasis(join, exit) {
    const tbody = document.querySelector('#join-basis-table tbody');
    tbody.innerHTML = ''; 
    let total = 0;

    // 1년차 미만 월차 (2017-05-30 이후 입사자만)
    if (join >= LAW_CHANGE_DATE) {
        let firstM = Math.min(11, Math.floor((exit - join) / (1000*60*60*24*30.44)));
        if (firstM > 0) {
            addRow(tbody, "1년차 미만", "매월 개근 시 발생", firstM.toFixed(1));
            total += firstM;
        }
    } else {
        addRow(tbody, "1년차 미만", "구법 대상 (월차 없음)", "0.0");
    }

    // 정기 연차
    let year = 1;
    while (true) {
        let d = new Date(join);
        d.setFullYear(join.getFullYear() + year);
        if (d > exit) break;
        let leave = Math.min(25, 15 + Math.floor((year - 1) / 2));
        addRow(tbody, `${year+1}년차`, d.toLocaleDateString(), leave.toFixed(1));
        total += leave;
        year++;
    }
    addRow(tbody, "합계", "-", total.toFixed(1));
}

// [회계연도 기준]
function renderAccountingBasis(join, exit) {
    const tbody = document.querySelector('#accounting-basis-table tbody');
    tbody.innerHTML = '';
    let total = 0;
    const joinYear = join.getFullYear();
    const nextJan1 = new Date(joinYear + 1, 0, 1);
    const oneYearAnn = new Date(join); oneYearAnn.setFullYear(joinYear + 1);

    // 개정법 적용 대상자만 월차 계산
    if (join >= LAW_CHANGE_DATE) {
        let firstYMonthly = 0;
        for (let i = 1; i <= 11; i++) {
            let d = new Date(join); d.setMonth(join.getMonth() + i);
            if (d < nextJan1 && d <= exit) firstYMonthly++;
        }
        if (firstYMonthly > 0) {
            addRow(tbody, joinYear, "입사년 월차", firstYMonthly.toFixed(1));
            total += firstYMonthly;
        }

        if (nextJan1 <= exit) {
            let secondYMonthly = 0;
            for (let i = 1; i <= 11; i++) {
                let d = new Date(join); d.setMonth(join.getMonth() + i);
                if (d >= nextJan1 && d < oneYearAnn && d <= exit) secondYMonthly++;
            }
            if (secondYMonthly > 0) {
                addRow(tbody, nextJan1.getFullYear(), "2년차 잔여 월차", secondYMonthly.toFixed(1));
                total += secondYMonthly;
            }
        }
    }

    // 비례분 및 정기 연차
    if (nextJan1 <= exit) {
        let prop = (15 * ((nextJan1 - join) / (1000*60*60*24) / 365));
        addRow(tbody, nextJan1.getFullYear(), "연차 비례분", prop.toFixed(1));
        total += prop;
    }

    let curYear = joinYear + 2;
    while (true) {
        let d = new Date(curYear, 0, 1); if (d > exit) break;
        let yc = curYear - joinYear;
        // 5년차(yc=4)부터 16개 발생 로직
        let leave = yc >= 4 ? 15 + Math.floor((yc - 2) / 2) : 15;
        if (leave > 25) leave = 25;
        addRow(tbody, curYear, `${yc+1}년차 정기`, leave.toFixed(1));
        total += leave;
        curYear++;
    }
    addRow(tbody, "합계", "-", total.toFixed(1));
}

function addRow(t, c1, c2, c3) {
    t.insertAdjacentHTML('beforeend', `<tr><td>${c1}</td><td>${c2}</td><td>${c3}</td></tr>`);
}