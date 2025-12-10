// 引入 ECharts (确保路径正确，指向你复制进去的 components 文件夹)
import * as echarts from '../../components/ec-canvas/echarts';

const computedBehavior = require('miniprogram-computed').behavior;

Page({
  behaviors: [computedBehavior],

  data: {
    ec: {
      lazyLoad: true // 延迟加载，手动初始化
    },
    isLoading: true,
    totalAssets: '0.00',
    totalProfit: '0.00',
    totalReturnRate: '0.00%',
    isGain: false,
    fundList: [],
  },

  computed: {
    headerClass(data) {
      return data.isGain ? 'bg-red-500' : 'bg-green-500';
    }
  },

  onLoad: function () {
    this.refreshData();
  },

  onPullDownRefresh: function () {
    this.refreshData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // === ECharts 初始化逻辑 ===
  initChart(chartData) {
    if (!chartData || chartData.length === 0) return;

    this.selectComponent('#mychart-dom-pie').init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });

      const option = {
        backgroundColor: "#ffffff",
        color: ['#37A2DA', '#32C5E9', '#67E0E3', '#91F2DE', '#FFDB5C', '#FF9F7F'],
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} ({d}%)' // 显示名称、数值、百分比
        },
        legend: {
          bottom: 0,
          left: 'center',
          itemWidth: 10,
          itemHeight: 10
        },
        series: [{
          name: '资产分布',
          type: 'pie',
          radius: ['40%', '60%'], // 环形图效果
          center: ['50%', '40%'], // 稍微向上调整，留出空间给 Legend
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '16',
              fontWeight: 'bold'
            }
          },
          data: chartData
        }]
      };

      chart.setOption(option);
      return chart;
    });
  },

  refreshData: async function () {
    this.setData({ isLoading: true });

    try {
      // 调用云函数 (fund-calculator 已经升级为读取数据库)
      const { result } = await wx.cloud.callFunction({
        name: 'fund-calculator'
      });

      // 错误处理
      if (result.error) {
        throw new Error(result.error);
      }

      console.log('云函数数据:', result);

      // 更新页面数据
      this.setData({
        fundList: result.dashboardData,
        totalAssets: result.summary.totalAssets,
        totalProfit: result.summary.totalProfit,
        totalReturnRate: result.summary.totalReturnRate,
        isGain: result.summary.isGain,
        isLoading: false
      });

      // 核心：渲染图表 (如果有图表数据)
      if (result.charts && result.charts.pie) {
        this.initChart(result.charts.pie);
      }

    } catch (err) {
      console.error('获取数据失败', err);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
      this.setData({ isLoading: false });
    }
  },
  // 跳转到交易详情页
  onToDetail(e) {
    const code = e.currentTarget.dataset.code;
    wx.navigateTo({
      url: `/pages/transactions/index?code=${code}`,
    });
  }
});