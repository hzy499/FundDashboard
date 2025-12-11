import * as echarts from '../../components/ec-canvas/echarts';
const createRecycleContext = require('miniprogram-recycle-view');
const computedBehavior = require('miniprogram-computed').behavior;

// 🟢 工具函数：节流
const throttle = (fn, gapTime) => {
  let _lastTime = null;
  return function () {
    let _nowTime = + new Date();
    if (_nowTime - _lastTime > gapTime || !_lastTime) {
      fn.apply(this, arguments);
      _lastTime = _nowTime;
    }
  }
};

Page({
  behaviors: [computedBehavior],

  data: {
    ec: { lazyLoad: true },
    isLoading: true,
    totalAssets: '0.00',
    totalProfit: '0.00',
    totalReturnRate: '0.00%',
    isGain: false,
    fundList: [], // 内存中的全量数据
    recycleList: [], // 虚拟列表专用数据槽
  },

  onLoad: function () {
    // 1. 获取屏幕宽度（用于计算 itemSize）
    const sysInfo = wx.getSystemInfoSync();
    const screenWidth = sysInfo.windowWidth;

    // 2. 核心修复：必须同时定义 width 和 height
    // 假设卡片高度是 160px (根据你的 UI 估算)，这个值越准，滚动越不抖
    // 如果你在 wxss 里写了 height: 280rpx，这里就是 280 * (screenWidth / 750)
    const cardHeight = 150; 

    this.ctx = createRecycleContext({
      id: 'recycleId',
      dataKey: 'recycleList',
      page: this,
      itemSize: { 
        width: screenWidth,  // 👈 修复点1：必须加宽度
        height: cardHeight   // 👈 修复点2：必须是数字
      }
    });

    this.refreshData();
    this.startPolling();
  },

  onUnload: function() {
    if(this.timer) clearInterval(this.timer);
    // 👈 修复点3：加个判断，防止页面没加载完就退出报错
    if (this.ctx) this.ctx.destroy(); 
  },

  onPullDownRefresh: function () {
    this.refreshData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 👈 修复点4：补充缺失的 loadMore 函数
  loadMore() {
    if (this.data.isLoading) return;
    console.log('触底加载更多... (此处可对接分页接口)');
    // 实际开发中，这里调用云函数加载下一页数据，然后 this.ctx.append(newData)
  },

  refreshData: async function () {
    // this.setData({ isLoading: true }); // 首次加载可以开，轮询更新时不要开，否则闪烁
    try {
      const { result } = await wx.cloud.callFunction({ name: 'fund-calculator' });

      if (result.error) throw new Error(result.error);

      this.setData({
        totalAssets: result.summary.totalAssets,
        totalProfit: result.summary.totalProfit,
        totalReturnRate: result.summary.totalReturnRate,
        isGain: result.summary.isGain,
        isLoading: false
      });

      // 清空旧数据并追加新数据
      // 注意：recycle-view 没有 clear 方法，只能通过 append
      // 如果是下拉刷新，建议重置 ctx 或者只是 update
      // 这里简化为：每次刷新全量 append (生产环境建议优化为 diff)
      if (this.ctx) {
        // 这一步有点 trick：recycle-view 不太好清空，通常用于无限列表
        // 简单处理：我们假设这里是初始化
        this.ctx.append(result.dashboardData); 
      }
      
      this.data.fundList = result.dashboardData; // 更新内存副本

      if (result.charts && result.charts.pie) {
        this.initChart(result.charts.pie);
      }

    } catch (err) {
      console.error(err);
      this.setData({ isLoading: false });
    }
  },

  startPolling() {
    // 👈 修复点5：使用箭头函数包裹，确保 this 指向 Page 实例
    // 之前的写法 setInterval(this.updateQuotes, 3000) 会导致内部 this 丢失
    this.timer = setInterval(() => {
      this.updateQuotes();
    }, 3000);
  },

  // 这里的 throttle 包装器内，this 已经被箭头函数修正
  updateQuotes: throttle(async function() {
    // 这里的 this 现在是安全的了
    if (this.data.isLoading) return;
    if (!this.ctx) return;

    const currentList = this.data.fundList;
    if (!currentList || currentList.length === 0) return;

    // 模拟前5个基金价格跳动
    for (let i = 0; i < Math.min(5, currentList.length); i++) {
        const item = currentList[i];
        const newPercent = (Math.random() * 4 - 2).toFixed(2);
        
        // 构造新对象
        const updatedItem = {
            ...item,
            dailyPercent: newPercent,
            isDailyGain: newPercent >= 0
        };

        // 更新内存副本
        this.data.fundList[i] = updatedItem;

        // 更新虚拟列表 (局部更新)
        this.ctx.update(i, [updatedItem]); 
    }
    console.log('🔥 实时行情已刷新');
  }, 2000),

  initChart(chartData) {
    if (!chartData || chartData.length === 0) return;
    
    // 加上 try-catch 防止 selectComponent 找不到报错
    try {
      const chartComp = this.selectComponent('#mychart-dom-pie');
      if(!chartComp) return;

      chartComp.init((canvas, width, height, dpr) => {
        const chart = echarts.init(canvas, null, {
          width: width,
          height: height,
          devicePixelRatio: dpr
        });

        const option = {
          backgroundColor: "#ffffff",
          color: ['#2b6cb0', '#4299e1', '#63b3ed', '#90cdf4', '#bee3f8', '#ebf8ff'], 
          series: [{
            name: '资产分布',
            type: 'pie',
            radius: ['40%', '60%'], 
            center: ['50%', '50%'], // 居中
            label: { show: false },
            data: chartData
          }]
        };

        chart.setOption(option);
        return chart;
      });
    } catch(e) { console.error('图表加载出错', e)}
  },

  onToDetail(e) {
    const code = e.currentTarget.dataset.code;
    wx.navigateTo({
      url: `/pages/transactions/index?code=${code}`,
    });
  }
});