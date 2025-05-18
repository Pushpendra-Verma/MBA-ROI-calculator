// Function to format numbers in Indian style (e.g., 12,34,567)
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

// Function to parse Indian formatted number to float
function parseIndianNumber(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/,/g, '')) || 0;
}

// Function to format input as Indian number while typing
function formatInputAsIndianNumber(input) {
  input.addEventListener('input', function () {
    let value = parseIndianNumber(this.value);
    if (!isNaN(value)) {
      this.value = formatIndianNumber(value);
    }
    calculateROI(); // Trigger calculation on input change
  });
}

// Apply Indian number formatting to financial inputs
['mbaCost', 'preSalary', 'postSalary', 'livingExpenses'].forEach(id => {
  formatInputAsIndianNumber(document.getElementById(id));
});

// Add dynamic updates for non-financial inputs
['mbaDuration', 'interestRate', 'growthRate', 'growthRatePostMba', 'loanTenure'].forEach(id => {
  document.getElementById(id).addEventListener('input', calculateROI);
});

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('active');
}

let salaryChart = null; // Initialize chart variable

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

  // Interest accrued during MBA duration (compounded monthly)
  const monthlyRate = interestRate / 12;
  let loanAmount = principalLoan;
  for (let i = 0; i < mbaDuration * 12; i++) {
    loanAmount *= (1 + monthlyRate);
  }

  // EMI calculation for repayment starting after MBA, lasting loanTenure years
  const totalMonths = loanTenure * 12;
  const monthlyEMI = loanAmount > 0 ?
    loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths) / (Math.pow(1 + monthlyRate, totalMonths) - 1) :
    0;
  const yearlyEMI = monthlyEMI * 12;
  const totalLoanRepayment = monthlyEMI * totalMonths;

  // Opportunity cost: Pre-MBA salary compounded over MBA duration
  let opportunityCost = 0;
  let currentPreSalary = preSalary;
  for (let i = 0; i < mbaDuration; i++) {
    opportunityCost += currentPreSalary;
    currentPreSalary *= (1 + growthRate);
  }

  // Total investment: MBA expense + opportunity cost
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

  // Include MBA duration and full loan tenure after MBA
  for (let year = 1; year <= mbaDuration + loanTenure; year++) {
    years.push(`Year ${year}`);
    let loanPaidThisYear = 0;

    if (year <= mbaDuration) {
      withMBASalaries.push(0);
      withoutMBASalaries.push(withoutMBASalary);
      tableData.push({
        year,
        loanPaid: 0,
        cumulativeLoan: 0,
        remainingLoan: loanAmount
      });
    } else {
      withMBASalary = (year === mbaDuration + 1) ? postSalary : withMBASalary * (1 + growthRatePostMba);
      withMBASalaries.push(withMBASalary);
      withoutMBASalaries.push(withoutMBASalary);

      if (year - mbaDuration <= loanTenure) {
        // Calculate loan balance monthly for accuracy
        let tempRemainingLoan = remainingLoan;
        for (let month = 1; month <= 12; month++) {
          if (tempRemainingLoan <= 0) break;
          const interest = tempRemainingLoan * monthlyRate;
          const principalPaid = Math.min(monthlyEMI, tempRemainingLoan + interest);
          tempRemainingLoan = tempRemainingLoan - (principalPaid - interest);
        }
        loanPaidThisYear = Math.min(yearlyEMI, remainingLoan + (remainingLoan * interestRate));
        cumulativeLoanPaid += loanPaidThisYear;
        remainingLoan = tempRemainingLoan > 0 ? tempRemainingLoan : 0;
        if (year - mbaDuration === loanTenure) {
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
  const roiPercentage = totalInvestment > 0 && yearsForROI > 0 ?
    ((Math.pow((netGain + totalInvestment) / totalInvestment, 1 / yearsForROI) - 1) * 100) :
    0;

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
      datasets: [{
          label: 'Salary with MBA (₹)',
          data: withMBASalaries,
          borderColor: 'green',
          fill: false,
          tension: 0.3
        },
        {
          label: 'Salary without MBA (₹)',
          data: withoutMBASalaries,
          borderColor: 'blue',
          fill: false,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true, // Ensures the chart resizes with the container
      maintainAspectRatio: false, // Allows custom aspect ratio based on container
      aspectRatio: 1.5, // Suggests a wider-than-tall chart (e.g., 600px wide x 400px high at max)
      plugins: {
        legend: {
          display: true
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function (context) {
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
            text: 'Salary (₹)'
          },
          ticks: {
            callback: function (value) {
              return '₹' + formatIndianNumber(value);
            }
          }
        },
        x: {
          title: {
            display: true,
            text: 'Year'
          }
        }
      }
    }
  });

  // Pie Chart for Cost Breakdown
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  if (window.pieChart) {
    window.pieChart.destroy();
  }
  window.pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: ['Total Fees', 'Opportunity Cost', 'Total Loan Repayment'],
      datasets: [{
        data: [totalFees, opportunityCost, totalLoanRepayment],
        backgroundColor: ['#36A2EB', '#FFCE56', '#4BC0C0']
      }]
    },
    options: {
      responsive: true, // Ensures the chart resizes with the container
      maintainAspectRatio: false, // Allows custom aspect ratio based on container
      aspectRatio: 1, // Keeps pie chart roughly square (e.g., 300px x 300px at min-height)
      plugins: {
        legend: {
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.label}: ₹${formatIndianNumber(context.raw)}`;
            }
          }
        }
      },
      title: {
        display: true,
        text: 'Cost Breakdown'
      }
    }
  });
}

// Initial calculation
calculateROI();