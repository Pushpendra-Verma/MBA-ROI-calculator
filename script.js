function formatIndianNumber(number) {
    if (isNaN(number) || number === null) return "0";
    let numStr = Math.round(number).toString();
    let lastThree = numStr.slice(-3);
    let otherDigits = numStr.slice(0, -3);
    if (otherDigits !== '') {
      lastThree = ',' + lastThree;
      otherDigits = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    }
    return otherDigits + lastThree;
}

function parseIndianNumber(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
}

function loadInputsFromLocal() {
  const saved = JSON.parse(localStorage.getItem('mbaUserInputs'));
  if (!saved) return;
  Object.entries(saved).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
}

function formatInputAsIndianNumber(input) {
  input.addEventListener('input', function() {
    let value = parseIndianNumber(this.value);
    if (!isNaN(value)) {
      this.value = formatIndianNumber(value);
    }
    calculateROI();
    saveInputsToLocal();
  });
}

['mbaCost', 'preSalary', 'postSalary', 'livingExpenses'].forEach(id => {
    formatInputAsIndianNumber(document.getElementById(id));
});

['mbaDuration', 'interestRate', 'growthRate', 'growthRatePostMba', 'loanTenure'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', () => {
      calculateROI();
      saveInputsToLocal();
    });
  }
});

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

let salaryChart = null;

function calculateROI() {
  // Parse inputs
  const mbaDuration = parseInt(document.getElementById("mbaDuration").value) || 2;
  const totalFees = parseIndianNumber(document.getElementById("mbaCost").value);
  const interestRate = (parseFloat(document.getElementById("interestRate").value) || 0) / 100;
  const loanTenure = parseInt(document.getElementById("loanTenure").value) || 10;
  const preSalary = parseIndianNumber(document.getElementById("preSalary").value);
  const postSalary = parseIndianNumber(document.getElementById("postSalary").value);
  const growthRate = (parseFloat(document.getElementById("growthRate").value) || 0) / 100;
  const growthRatePostMba = (parseFloat(document.getElementById("growthRatePostMba").value) || 0) / 100;
  const livingExpenses = parseIndianNumber(document.getElementById("livingExpenses").value);

  // Calculations
  const totalLivingExpenses = livingExpenses * mbaDuration;
  const principalLoan = totalFees + totalLivingExpenses;

  // Quarterly disbursements for totalFees over mbaDuration
  const quarters = mbaDuration * 4;
  const quarterlyFee = totalFees / quarters;

  // Interest accrued during moratorium period (mbaDuration + 1 years, compounded yearly)
  const moratoriumYears = mbaDuration + 1;
  let loanAmount = totalLivingExpenses; // Living expenses disbursed upfront
  let disbursedFees = 0;

  // Track disbursed fees and interest yearly
  for (let year = 1; year <= moratoriumYears; year++) {
    // Add quarterly disbursements for the year (4 quarters, except in the last moratorium year)
    const quartersThisYear = year <= mbaDuration ? 4 : 0; // No disbursements in extra moratorium year
    for (let q = 1; q <= quartersThisYear; q++) {
      disbursedFees += quarterlyFee;
    }
    // Apply yearly compounding to the total disbursed amount so far
    loanAmount = (loanAmount + (year <= mbaDuration ? quarterlyFee * 4 : 0)) * (1 + interestRate);
  }

  // EMI calculation for repayment starting after moratorium, lasting loanTenure years
  const totalMonths = loanTenure * 12;
  const monthlyRate = interestRate / 12;
  const monthlyEMI = loanAmount > 0
    ? loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths) / (Math.pow(1 + monthlyRate, totalMonths) - 1)
    : 0;
  const yearlyEMI = monthlyEMI * 12;
  const totalLoanRepayment = monthlyEMI * totalMonths;

  // Opportunity cost: Pre-MBA salary compounded over MBA duration
  let opportunityCost = 0;
  let currentPreSalary = preSalary;
  for (let i = 0; i < mbaDuration; i++) {
    opportunityCost += currentPreSalary;
    currentPreSalary *= (1 + growthRate);
  }

  // Total investment: MBA expense (principalLoan) + opportunity cost
  const totalInvestment = principalLoan + opportunityCost;

  // Salary projections and loan repayment
  let withMBASalary = 0;
  let withoutMBASalary = preSalary;
  let cumulativeLoanPaid = 0;
  let remainingLoan = loanAmount;
  let totalGain = -totalInvestment;
  let breakevenYear = 0;

  const years = [];
  const withMBASalaries = [];
  const withoutMBASalaries = [];
  const tableData = [];

  // Include moratorium period and loan tenure after moratorium
  for (let year = 1; year <= moratoriumYears + loanTenure; year++) {
    years.push(`Year ${year}`);
    let loanPaidThisYear = 0;

    if (year <= moratoriumYears) {
      withMBASalaries.push(0);
      withoutMBASalaries.push(withoutMBASalary);
      // Calculate disbursed amount and interest up to this year
      let yearDisbursedFees = 0;
      for (let y = 1; y <= Math.min(year, mbaDuration); y++) {
        yearDisbursedFees += quarterlyFee * 4;
      }
      let yearLoan = totalLivingExpenses + yearDisbursedFees;
      for (let y = 1; y <= year; y++) {
        yearLoan *= (1 + interestRate);
      }
      tableData.push({
        year,
        loanPaid: 0,
        cumulativeLoan: 0,
        remainingLoan: yearLoan
      });
    } else {
      withMBASalary = (year === moratoriumYears + 1) ? postSalary : withMBASalary * (1 + growthRatePostMba);
      withMBASalaries.push(withMBASalary);
      withoutMBASalaries.push(withoutMBASalary);

      if (year - moratoriumYears <= loanTenure) {
        // Calculate loan balance monthly for accuracy
        let tempRemainingLoan = remainingLoan;
        for (let month = 1; month <= 12; month++) {
          if (tempRemainingLoan <= 0) break;
          const interest = tempRemainingLoan * monthlyRate;
          const principalPaid = Math.min(monthlyEMI - interest, tempRemainingLoan);
          tempRemainingLoan -= principalPaid;
        }
        loanPaidThisYear = Math.min(yearlyEMI, remainingLoan + (remainingLoan * interestRate));
        cumulativeLoanPaid += loanPaidThisYear;
        remainingLoan = tempRemainingLoan > 0 ? tempRemainingLoan : 0;
        if (year - moratoriumYears === loanTenure) {
          remainingLoan = 0; // Ensure loan is fully paid at the end
        }
        // Net gain is the difference between post-MBA and pre-MBA salary, adjusted for EMI
        const netGain = withMBASalary - withoutMBASalary - loanPaidThisYear;
        totalGain += netGain;

        // Breakeven check: only when totalGain becomes non-negative
        if (totalGain >= 0 && breakevenYear === 0) {
          breakevenYear = year;
        }
      }

      tableData.push({
        year,
        loanPaid: loanPaidThisYear,
        cumulativeLoan: cumulativeLoanPaid,
        remainingLoan: remainingLoan
      });
    }
    withoutMBASalary *= (1 + growthRate);
  }

  // ROI Percentage: Annualized over loan tenure post-MBA
  const netGain = totalGain;
  const yearsForROI = loanTenure;
  const roiPercentage = totalInvestment > 0 && yearsForROI > 0
    ? ((Math.pow((netGain + totalInvestment) / totalInvestment, 1 / yearsForROI) - 1) * 100)
    : 0;

  // Output results
  let output = `
    <p><strong>Total Fees:</strong> ₹${formatIndianNumber(totalFees)}</p>
    <p><strong>Opportunity Cost:</strong> ₹${formatIndianNumber(opportunityCost)}</p>
    <p><strong>Monthly EMI:</strong> ₹${formatIndianNumber(monthlyEMI.toFixed(2))}</p>
    <p><strong>Total Loan Repayment:</strong> ₹${formatIndianNumber(totalLoanRepayment)}</p>
    <p><strong>Total Investment:</strong> ₹${formatIndianNumber(totalInvestment)}</p>
    <p><strong>Breakeven Years:</strong> ${breakevenYear || 'N/A'}</p>
    <p><strong>Annualized ROI:</strong> ${roiPercentage.toFixed(2)}%</p>
  `;
  document.getElementById("output").innerHTML = output;

  // Table
  let tableHTML = `
    <tr>
      <th>Year</th>
      <th>Loan Paid (₹)</th>
      <th>Cumulative Loan Paid (₹)</th>
      <th>Remaining Loan (₹)</th>
    </tr>
  `;
  tableData.forEach(row => {
    tableHTML += `
      <tr>
        <td>${row.year}</td>
        <td>₹${formatIndianNumber(row.loanPaid)}</td>
        <td>₹${formatIndianNumber(row.cumulativeLoan)}</td>
        <td>₹${formatIndianNumber(row.remainingLoan)}</td>
      </tr>
    `;
  });
  document.getElementById("resultsTable").innerHTML = tableHTML;

// Chart
  const ctx = document.getElementById('salaryChart').getContext('2d');
  if (salaryChart) {
    salaryChart.destroy();
  }
  salaryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Salary with MBA (₹)',
          data: withMBASalaries,
          borderColor: '#36A2EB', // Softer blue for cleaner look
          backgroundColor: 'rgba(54, 162, 235, 0.1)', // Subtle fill
          borderWidth: 2, // Thinner lines
          pointRadius: 3, // Smaller points
          fill: false,
          tension: 0.3
        },
        {
          label: 'Salary without MBA (₹)',
          data: withoutMBASalaries,
          borderColor: '#4BC0C0', // Softer teal
          backgroundColor: 'rgba(75, 192, 192, 0.1)', // Subtle fill
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 1.5,
      plugins: {
        legend: {
          display: true,
          labels: {
            font: {
              size: 12, // Smaller legend font
              family: 'Segoe UI'
            },
            color: '#333'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: { size: 14 },
          bodyFont: { size: 12 },
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ₹${formatIndianNumber(context.parsed.y)}`;
            }
          }
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Salary (₹ Lakhs)',
            font: { size: 14, family: 'Segoe UI' }
          },
          ticks: {
            callback: function(value) {
              return '₹' + (value / 100000).toFixed(1); // Convert to lakhs
            },
            font: { size: 12 }, // Smaller tick font
            stepSize: 100000, // Adjust step size for cleaner grid
            padding: 5
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)', // Lighter grid lines
            lineWidth: 1
          }
        },
        x: {
          title: {
            display: true,
            text: 'Year',
            font: { size: 14, family: 'Segoe UI' }
          },
          ticks: {
            font: { size: 12 },
            maxRotation: 45, // Slight rotation for long labels
            minRotation: 45
          },
          grid: {
            display: false // Remove x-axis grid for cleaner look
          }
        }
      }
    }
  });

  // // Pie Chart for Cost Breakdown
  // const pieCtx = document.getElementById('pieChart').getContext('2d');
  // if (window.pieChart) {
  //   window.pieChart.destroy();
  // }
  // window.pieChart = new Chart(pieCtx, {
  //   type: 'pie',
  //   data: {
  //     labels: ['Total Fees', 'Opportunity Cost', 'Total Loan Repayment'],
  //     datasets: [{
  //       data: [totalFees, opportunityCost, totalLoanRepayment],
  //       backgroundColor: ['#36A2EB', '#FFCE56', '#4BC0C0']
  //     }]
  //   },
  //   options: {
  //     responsive: true,
  //     maintainAspectRatio: false,
  //     aspectRatio: 1,
  //     plugins: {
  //       legend: { position: 'top' },
  //       tooltip: {
  //         callbacks: {
  //           label: function(context) {
  //             return `${context.label}: ₹${formatIndianNumber(context.raw)}`;
  //           }
  //         }
  //       }
  //     },
  //     title: {
  //       display: true,
  //       text: 'Cost Breakdown'
  //     }
  //   }
  // });
}

loadInputsFromLocal();
calculateROI();