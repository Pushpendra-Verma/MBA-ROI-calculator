// optimized.js

const termPaymentMethods = {
    1: 'paid',
    2: 'loan',
    3: 'loan',
    4: 'loan',
    5: 'loan',
    6: 'loan'
};

let optimizationChart = null;
const ctx = document.getElementById('optimizationChart').getContext('2d');

function formatNumber(num) {
    return '₹' + num.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function loadInputsFromLocal() {
    const saved = JSON.parse(localStorage.getItem('loanBreakdownInputs'));
    if (!saved) return;

    Object.entries(saved).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) {
            if (id.includes('toggle')) {
                el.checked = val;
                const term = id.match(/\d+/)[0];
                termPaymentMethods[term] = val ? 'loan' : 'paid';
            } else {
                el.value = val;
            }
        }
    });

    const postSalaryEl = document.getElementById('post-salary');
    if (!postSalaryEl.value) {
        postSalaryEl.value = 900000;
    }
}

function toggleCSIS() {
    debouncedCalculateOptimization();
}

function toggleTermPayment(term) {
    const toggle = document.getElementById(`term${term}-toggle`);
    termPaymentMethods[term] = toggle.checked ? 'loan' : 'paid';
    debouncedCalculateOptimization();
}

['moratorium-months', 'term1-fee', 'term2-fee', 'term3-fee', 'term4-fee', 'term5-fee', 'term6-fee', 'interest-rate', 'post-salary'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', debouncedCalculateOptimization);
    }
});

function calculateOptimization() {
    const csisEnabled = document.getElementById('csis-toggle').checked;

    const termFees = [
        parseFloat(document.getElementById('term1-fee').value) || 0,
        parseFloat(document.getElementById('term2-fee').value) || 0,
        parseFloat(document.getElementById('term3-fee').value) || 0,
        parseFloat(document.getElementById('term4-fee').value) || 0,
        parseFloat(document.getElementById('term5-fee').value) || 0,
        parseFloat(document.getElementById('term6-fee').value) || 0
    ];
    const interestRate = parseFloat(document.getElementById('interest-rate').value) || 0;
    const moratoriumMonths = parseFloat(document.getElementById('moratorium-months').value) || 0;
    const postSalary = parseFloat(document.getElementById('post-salary').value) || 900000;
    const monthlySalary = postSalary / 12;

    let totalCashPaid = 0;
    termFees.forEach((fee, i) => {
        if (termPaymentMethods[i + 1] === 'paid') totalCashPaid += fee;
    });

    const disbursementMonths = [0, 4, 8, 12, 16, 20];
    const totalFees = termFees.reduce((a, b) => a + b, 0);
    const loanAmount = totalFees - totalCashPaid;

    const disbursements = termFees.map((fee, i) => termPaymentMethods[i + 1] === 'paid' ? 0 : fee);
    const annualRate = interestRate / 100;
    const monthlyRate = annualRate / 12;

    let totalMoratoriumInterest = 0;
    let csisCoveredInterest = 0;
    let cumulativeLoan = 0;

    disbursements.forEach((amount, i) => {
        if (amount === 0) return;

        const monthsToRepayment = moratoriumMonths - disbursementMonths[i];
        const years = monthsToRepayment / 12;

        const compoundInterest = amount * Math.pow(1 + annualRate, years) - amount;
        totalMoratoriumInterest += compoundInterest;

        let coveredByCSIS = 0;
        const newCumulative = cumulativeLoan + amount;

        if (csisEnabled) {
            if (cumulativeLoan >= 1000000) {
                coveredByCSIS = 0;
            } else if (newCumulative <= 1000000) {
                coveredByCSIS = compoundInterest;
            } else {
                const eligibleAmount = 1000000 - cumulativeLoan;
                const ratio = eligibleAmount / amount;
                coveredByCSIS = compoundInterest * ratio;
            }
        }

        csisCoveredInterest += coveredByCSIS;
        cumulativeLoan = newCumulative;
    });

    const interestMoratorium = totalMoratoriumInterest - csisCoveredInterest;
    const principalAfter = loanAmount + interestMoratorium;

    const repaymentYears = [5, 6, 7];
    const scenarios = [];

    repaymentYears.forEach(years => {
        const repaymentMonths = years * 12;
        const r = monthlyRate;
        const n = repaymentMonths;
        const emi = (r === 0 || n === 0) ? principalAfter / (n || 1) :
            (principalAfter * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

        const totalRepayment = emi * n;
        const repaymentInterest = totalRepayment - principalAfter;
        const totalInterest = interestMoratorium + repaymentInterest;

        const salaryPercentage = (emi / monthlySalary) * 100;

        scenarios.push({
            years: years,
            months: repaymentMonths,
            emi: emi,
            totalInterest: totalInterest,
            salaryPercentage: salaryPercentage
        });
    });

    scenarios.sort((a, b) => {
        const scoreA = (a.salaryPercentage / 50) + (a.totalInterest / scenarios[0].totalInterest);
        const scoreB = (b.salaryPercentage / 50) + (b.totalInterest / scenarios[0].totalInterest);
        return scoreA - scoreB;
    });

    if (optimizationChart) {
        optimizationChart.destroy();
    }

    const emis = scenarios.map(s => s.emi);
    const totalInterests = scenarios.map(s => s.totalInterest);
    const salaryPercentages = scenarios.map(s => s.salaryPercentage);

    optimizationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: repaymentYears,
            datasets: [
                {
                    label: 'Monthly EMI (₹)',
                    data: emis,
                    borderColor: '#1E88E5',
                    backgroundColor: '#1E88E5',
                    pointBackgroundColor: '#1E88E5',
                    pointBorderColor: '#fff',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    fill: false,
                    yAxisID: 'y-left',
                    borderWidth: 4,
                    tension: 0.3
                },
                {
                    label: 'Total Interest Paid (₹)',
                    data: totalInterests,
                    borderColor: '#F4511E',
                    backgroundColor: '#F4511E',
                    pointBackgroundColor: '#F4511E',
                    pointBorderColor: '#fff',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    fill: false,
                    yAxisID: 'y-right',
                    borderWidth: 4,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Optimized Loan Repayment Analysis',
                    font: {
                        size: 18,
                        family: 'Roboto',
                        weight: '500'
                    },
                    color: '#333',
                    padding: 20
                },
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            family: 'Roboto'
                        },
                        color: '#333',
                        padding: 15
                    }
                },
                tooltip: {
                    enabled: false,  //i have disabled the default tooltip
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14,
                        family: 'Roboto'
                    },
                    bodyFont: {
                        size: 12,
                        family: 'Roboto'
                    },
                    callbacks: {
                        label: function(tooltipItem) {
                            const datasetLabel = tooltipItem.dataset.label;
                            const value = tooltipItem.raw;
                            const yearIndex = tooltipItem.dataIndex;
                            const salaryPercentage = salaryPercentages[yearIndex];
                            if (datasetLabel.includes('EMI')) {
                                return [
                                    `${datasetLabel}: ₹${Math.round(value).toLocaleString()}`,
                                    `EMI as % of Salary: ${salaryPercentage.toFixed(1)}%`
                                ];
                            }
                            return `${datasetLabel}: ₹${Math.round(value).toLocaleString()}`;
                        }
                    }
                },
                annotation: {
                    annotations: [
                        {
                            type: 'line',
                            mode: 'vertical',
                            scaleID: 'x-axis-0',
                            value: 6,
                            borderColor: '#43A047',
                            borderWidth: 3,
                            borderDash: [6, 6],
                            label: {
                                enabled: false,
                                content: 'Optimal: 6 Years',
                                position: 'top',
                                backgroundColor: '#43A047',
                                font: {
                                    size: 14,
                                    family: 'Roboto',
                                    weight: '500'
                                },
                                color: '#fff',
                                xPadding: 10,
                                yPadding: 8,
                                yAdjust: -10
                            }
                        }
                    ]
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Repayment Period (Years)',
                        font: {
                            size: 16,
                            family: 'Roboto',
                            weight: '500'
                        },
                        color: '#333',
                        padding: 10
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 14,
                            family: 'Roboto'
                        },
                        color: '#666',
                        stepSize: 1
                    }
                },
                'y-left': {
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Monthly EMI (₹)',
                        font: {
                            size: 16,
                            family: 'Roboto',
                            weight: '500'
                        },
                        color: '#1E88E5',
                        padding: 10
                    },
                    ticks: {
                        beginAtZero: false,
                        font: {
                            size: 14,
                            family: 'Roboto'
                        },
                        color: '#1E88E5',
                        callback: function(value) {
                            return '₹' + Math.round(value).toLocaleString();
                        },
                        stepSize: 5000,
                        padding: 10,
                        maxTicksLimit: 6
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    }
                },
                'y-right': {
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Total Interest Paid (₹)',
                        font: {
                            size: 16,
                            family: 'Roboto',
                            weight: '500'
                        },
                        color: '#F4511E',
                        padding: 10
                    },
                    ticks: {
                        beginAtZero: false,
                        font: {
                            size: 14,
                            family: 'Roboto'
                        },
                        color: '#F4511E',
                        callback: function(value) {
                            return '₹' + Math.round(value).toLocaleString();
                        },
                        stepSize: 100000,
                        padding: 10,
                        maxTicksLimit: 6
                    },
                    grid: {
                        display: false
                    }
                }
            },
            layout: {
                padding: {
                    left: 20,
                    right: 20,
                    top: 20,
                    bottom: 20
                }
            }
        }
    });

    let tableHTML = `
        <tr>
            <th>Rank</th>
            <th>Repayment Period (Years)</th>
            <th>Months</th>
            <th>Monthly EMI (₹)</th>
            <th>Total Interest Paid (₹)</th>
            <th>EMI as % of Salary</th>
        </tr>
    `;
    const ranks = ['Best', 'Second Best', 'Third Best'];
    scenarios.forEach((scenario, index) => {
        tableHTML += `
            <tr>
                <td>${ranks[index]}</td>
                <td>${scenario.years}</td>
                <td>${scenario.months}</td>
                <td>₹${Math.round(scenario.emi).toLocaleString()}</td>
                <td>₹${Math.round(scenario.totalInterest).toLocaleString()}</td>
                <td>${scenario.salaryPercentage.toFixed(1)}%</td>
            </tr>
        `;
    });
    document.getElementById('optimizationTable').innerHTML = tableHTML;
}

let debounceTimeout;
function debouncedCalculateOptimization() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(calculateOptimization, 300);
}

loadInputsFromLocal();
calculateOptimization();