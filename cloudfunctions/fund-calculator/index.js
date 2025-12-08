// cloudfunctions/fund-calculator/index.js
const cloud = require('wx-server-sdk');
const Decimal = require('decimal.js');
const dayjs = require('dayjs');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 1. 模拟获取实时行情 (替代 Python 的 akshare)
// 真实场景中，这里会调用第三方财经 API
async function fetchMarketData(codes) {
  const marketMap = {};
  codes.forEach(code => {
    // 模拟波动：随机生成 -2% 到 +2% 之间的涨跌
    const randomFluctuation = (Math.random() * 0.04 - 0.02);
    // 假设基准净值为 1.5 (仅演示用)
    const mockPrice = 1.5 * (1 + randomFluctuation);

    marketMap[code] = {
      price: mockPrice, // 实时净值
      percent: (randomFluctuation * 100).toFixed(2), // 涨跌幅
      date: dayjs().format('YYYY-MM-DD')
    };
  });
  return marketMap;
}

// 辅助函数：安全转数字
const safeNum = (val) => new Decimal(val || 0);

exports.main = async (event, context) => {
  try {
    // === 第一步：从数据库拉取持仓 ===
    // 使用聚合查询 (Aggregate) 将持仓表(user_portfolio)与基础信息表(fund_basic)关联
    const fundsRes = await db.collection('user_portfolio')
      .aggregate()
      .lookup({
        from: 'fund_basic',
        localField: 'fund_code',
        foreignField: '_id',
        as: 'basic_info'
      })
      .limit(100)
      .end();

    const funds = fundsRes.list;

    if (funds.length === 0) {
      return { totalAssets: '0.00', dashboardData: [], charts: {} };
    }

    // === 第二步：获取行情 ===
    const codes = funds.map(f => f.fund_code);
    const marketData = await fetchMarketData(codes);

    // === 第三步：核心指标计算 ===
    let totalAssets = new Decimal(0);
    let totalProfit = new Decimal(0);
    let totalCost = new Decimal(0);

    // 用于饼图统计：{ "混合型": 5000, "股票型": 3000 }
    const typeAllocation = {};

    const dashboardData = funds.map(fund => {
      // 解构关联查询出的元数据
      const info = fund.basic_info[0] || {};
      const name = info.name || '未知基金';
      const type = info.type || '其他';
      const code = fund.fund_code;

      // 获取价格
      const marketInfo = marketData[code] || { price: fund.avg_cost, percent: 0 };
      const currentPrice = safeNum(marketInfo.price);
      const costPrice = safeNum(fund.avg_cost);
      const shares = safeNum(fund.total_shares);

      // 计算：市值、成本、收益
      const marketValue = shares.times(currentPrice);
      const costValue = shares.times(costPrice);
      const profit = marketValue.minus(costValue);
      const returnRate = costValue.isZero() ? new Decimal(0) : profit.div(costValue).times(100);

      // 累加总数
      totalAssets = totalAssets.plus(marketValue);
      totalProfit = totalProfit.plus(profit);
      totalCost = totalCost.plus(costValue);

      // 统计资产分布 (Pie Chart Data)
      const valFloat = parseFloat(marketValue.toFixed(2));
      if (typeAllocation[type]) {
        typeAllocation[type] += valFloat;
      } else {
        typeAllocation[type] = valFloat;
      }

      return {
        code,
        name,
        type,
        shares: fund.total_shares.toFixed(2),
        cost: fund.avg_cost.toFixed(4),
        price: currentPrice.toFixed(4),
        dailyPercent: marketInfo.percent,
        marketValue: marketValue.toFixed(2),
        profit: profit.toFixed(2),
        returnRate: returnRate.toFixed(2) + '%',
        isGain: profit.greaterThanOrEqualTo(0),
        updateTime: marketInfo.date
      };
    });

    // === 第四步：封装图表数据 ===
    
    // 1. 饼图数据格式化 (适配 ECharts)
    const pieChartData = Object.keys(typeAllocation).map(key => ({
      name: key,
      value: parseFloat(typeAllocation[key].toFixed(2))
    }));

    // 2. (可选) 模拟7日收益走势
    const lineChartData = {
      dates: [],
      values: []
    };
    for(let i=6; i>=0; i--) {
      lineChartData.dates.push(dayjs().subtract(i, 'day').format('MM-DD'));
      // 模拟一点波动
      const mockVal = parseFloat(totalAssets.toFixed(2)) * (1 - i * 0.005);
      lineChartData.values.push(mockVal.toFixed(2));
    }

    const totalReturnRate = totalCost.isZero() ? '0.00' : totalProfit.div(totalCost).times(100).toFixed(2);

    return {
      dashboardData,
      summary: {
        totalAssets: totalAssets.toFixed(2),
        totalProfit: totalProfit.toFixed(2),
        totalReturnRate: totalReturnRate + '%',
        isGain: totalProfit.greaterThanOrEqualTo(0)
      },
      charts: {
        pie: pieChartData,
        line: lineChartData
      }
    };

  } catch (err) {
    console.error(err);
    return { error: err.message };
  }
};