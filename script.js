let currentTab = 'leave-tab';
const LAW_CHANGE_DATE = new Date('2017-05-30');

// 탭 전환
function openTab(t) {
    currentTab = t;
    document.getElementById('date-inputs').style.display = t === 'leave-tab' ? 'block' : 'none';
    document.getElementById('money-inputs').style.display = t === 'money-tab' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach((b, i) => {
        b.classList.toggle('active', (i === 0 && t === 'leave-tab') || (i === 1 && t === 'money-tab'));
    });
}

// 수당 항목 추가
function addAllowanceField() {
    const list = document.getElementById('allowance-list');
    const row = document.createElement('div');
    row.className = 'allowance-row';
    row.innerHTML = `
        <input type="text" placeholder="수당명(식대 등)" style="width:55%">
        <input type="number" placeholder="금액" class="allowance-value" style="width:30%">
        <button class="remove-btn" onclick="this.parentElement.remove()">×</button>
    `;
    list.appendChild(row);
}

// 메인 계산
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

// ✅ 수정된 연차 계산 (버그 수정 + 트래커 연동)
function calculateLeave() {
    const joinInput = document.getElementById('join-date').value;
    const exitInput = document.getElementById('exit-date').value;
    if(!joinInput || !exitInput) { alert("날짜를 입력해주세요!"); return; }

    const join = new Date(joinInput);
    const exit = new Date(exitInput);
    
    if (exit <= join) {
        alert("퇴사일은 입사일보다 이후여야 합니다!");
        return;
    }
    
    const totalJoin = renderJoinBasis(join, exit);
    const totalAccounting = renderAccountingBasis(join, exit);
    
    // 근로자에게 유리한 기준 자동 선택
    const maxTotal = Math.max(totalJoin, totalAccounting);
    const usedDays = Number(document.getElementById('used-leave').value) || 0;
    const remainDays = maxTotal - usedDays;
    
    updateLeaveTracker(maxTotal, usedDays, remainDays);
    updateSummaryBanner(Math.max(0, remainDays), totalJoin >= totalAccounting ? '입사일 기준' : '회계연도 기준');
}

// ✅ 수정된 입사일 기준 계산 (가산연차 버그 수정)
function renderJoinBasis(join, exit) {
    const tbody = document.querySelector('#join-basis-table tbody');
    tbody.innerHTML = ''; 
    let total = 0;

    // 월차 (정확한 개월 수 계산)
    if (join >= LAW_CHANGE_DATE) {
        let firstM = getActualMonths(join, exit);
        if (firstM > 0) {
            addRow(tbody, "1년차 미만", "매월 개근 시 발생", firstM.toFixed(1));
            total += firstM;
        }
    } else {
        addRow(tbody, "1년차 미만", "구법 대상 (월차 없음)", "0.0");
    }

    // 정기 연차 (3년차부터 가산 적용)
    let year = 1;
    while (true) {
        let d = new Date(join);
        d.setFullYear(join.getFullYear() + year);
        if (d > exit) break;
        // 3년차(year=2)부터 가산: 15 + Math.floor((year-1)/2)
        let leave = Math.min(25, year >= 2 ? 15 + Math.floor((year-1)/2) : 15);
        addRow(tbody, `${year+1}년차`, d.toLocaleDateString(), leave.toFixed(1));
        total += leave;
        year++;
    }
    addRow(tbody, "합계", "-", total.toFixed(1));
    return total;
}

// ✅ 수정된 회계연도 기준 계산 (윤년 반영)
function renderAccountingBasis(join, exit) {
    const tbody = document.querySelector('#accounting-basis-table tbody');
    tbody.innerHTML = '';
    let total = 0;
    const joinYear = join.getFullYear();
    const nextJan1 = new Date(joinYear + 1, 0, 1);
    const oneYearAnn = new Date(join); 
    oneYearAnn.setFullYear(joinYear + 1);

    // 월차 계산
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

    // 비례분 (윤년 반영)
    if (nextJan1 <= exit) {
        const isLeapYear = (joinYear % 4 === 0 && joinYear % 100 !== 0) || (joinYear % 400 === 0);
        const daysInYear = isLeapYear ? 366 : 365;
        let prop = (15 * ((nextJan1 - join) / (1000*60*60*24) / daysInYear));
        addRow(tbody, nextJan1.getFullYear(), "연차 비례분", prop.toFixed(1));
        total += prop;
    }

    // 정기 연차 (3년차부터 가산)
    let curYear = joinYear + 2;
    while (true) {
        let d = new Date(curYear, 0, 1); 
        if (d > exit) break;
        let yc = curYear - joinYear;
        let leave = yc >= 2 ? Math.min(25, 15 + Math.floor((yc-1)/2)) : 15;
        addRow(tbody, curYear, `${yc+1}년차 정기`, leave.toFixed(1));
        total += leave;
        curYear++;
    }
    addRow(tbody, "합계", "-", total.toFixed(1));
    return total;
}

// 수당 계산
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

// ✅ 새로 추가된 트래커 관련 함수들
function updateLeaveTracker(total, used, remain) {
    const tracker = document.getElementById('leave-tracker');
    const warning = document.getElementById('tracker-warning');
    const sendBtn = document.getElementById('auto-send-btn');
    
    document.getElementById('tracker-total').textContent = total.toFixed(1) + '일';
    document.getElementById('tracker-used').textContent = used.toFixed(1) + '일';
    
    const remainEl = document.getElementById('tracker-remain');
    if (remain < 0) {
        remainEl.textContent = remain.toFixed(1) + '일';
        remainEl.className = 'tracker-value danger';
        warning.style.display = 'block';
        sendBtn.disabled = true;
    } else {
        remainEl.textContent = remain.toFixed(1) + '일';
        remainEl.className = 'tracker-value remain';
        warning.style.display = 'none';
        sendBtn.disabled = remain === 0;
    }
    
    tracker.style.display = 'block';
}

function updateSummaryBanner(remainDays, basisType) {
    const banner = document.getElementById('summary-banner');
    document.getElementById('banner-amount').textContent = remainDays.toFixed(1) + '일';
    document.getElementById('banner-sub').textContent = `${basisType} 적용 (근로자 유리 기준)`;
    banner.style.display = 'block';
}

function sendToMoneyTab() {
    const remainText = document.getElementById('tracker-remain').textContent;
    const remainValue = parseFloat(remainText);
    
    if (remainValue <= 0) {
        alert('잔여 연차가 없거나 초과 사용 상태입니다!');
        return;
    }
    
    openTab('money-tab');
    
    const input = document.getElementById('unused-days');
    input.value = remainValue.toFixed(1);
    input.style.borderColor = '#764ba2';
    input.style.background = '#fdfaff';
    
    setTimeout(() => {
        input.style.borderColor = '#eee';
        input.style.background = 'white';
    }, 2000);
    
    alert(`✅ 잔여 연차 ${remainValue.toFixed(1)}일이 수당 계산에 자동 입력되었습니다!`);
}

// ✅ 유틸리티 함수들
function addRow(t, c1, c2, c3) {
    t.insertAdjacentHTML('beforeend', `<tr><td>${c1}</td><td>${c2}</td><td>${c3}</td></tr>`);
}

function getActualMonths(startDate, endDate) {
    let months = 0;
    let currentDate = new Date(startDate);
    
    while (currentDate < endDate) {
        currentDate.setMonth(currentDate.getMonth() + 1);
        if (currentDate <= endDate) {
            months++;
        }
        if (months >= 11) break;
    }
    return months;
}

// 실시간 업데이트
document.getElementById('used-leave').addEventListener('input', function() {
    const leaveReport = document.getElementById('leave-report');
    if (leaveReport && leaveReport.style.display !== 'none') {
        calculateLeave();
    }
});

// ✅ 날짜 입력 연도 4자리 제한 기능
function limitDateYearInput(input) {
    const value = input.value;
    if (!value) return;
    
    // yyyy-mm-dd 형식에서 연도 부분 추출 및 제한
    const parts = value.split('-');
    const year = parts[0];
    
    // 연도가 4자리를 초과하면 4자리로 자르기
    if (year && year.length > 4) {
        parts[0] = year.slice(0, 4);
        input.value = parts.join('-');
    }
    
    // 연도가 너무 큰 값이면 현실적인 범위로 제한
    const yearNum = parseInt(parts[0]);
    if (yearNum > 2100) {
        parts[0] = '2100';
        input.value = parts.join('-');
    }
}

// 모든 날짜 입력 필드에 이벤트 연결
function setupDateInputLimits() {
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        // HTML 속성으로도 최대값 제한
        input.max = "2100-12-31";
        
        // 입력 이벤트 연결
        input.addEventListener('input', function() {
            limitDateYearInput(this);
        });
        
        // 변경 이벤트도 연결 (복사-붙여넣기 대응)
        input.addEventListener('change', function() {
            limitDateYearInput(this);
        });
    });
}

// DOM 로드 완료 시 실행
document.addEventListener('DOMContentLoaded', setupDateInputLimits);

// 이미 DOM이 로드된 경우를 위한 즉시 실행
if (document.readyState === 'loading') {
    // DOM이 아직 로딩 중이면 DOMContentLoaded 이벤트를 기다림
} else {
    // DOM이 이미 로드되었으면 즉시 실행
    setupDateInputLimits();
}