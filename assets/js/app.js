    const REMOTE_JSON = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
    const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
    const ESPN_SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";
    const ESPN_HEADER_SCOREBOARD = "https://site.api.espn.com/apis/v2/scoreboard/header";

    // 实时比分稳定方案：部署 score-proxy-worker.js 到 Cloudflare Worker 后，
    // 把这里改成你的 Worker 地址，例如：https://wc-score-proxy.xxx.workers.dev
    // 为空时仍会走原来的直连/公共代理兜底，但 iOS Safari 下可能不稳定。
    const SCORE_PROXY_BASE = "";

    const ESPN_SCORE_TZ = "America/New_York";
    const TZ_MAIN = "America/Monterrey";
    const TZ_CHINA = "Asia/Shanghai";
    const CACHE_KEY = "wc2026_schedule_mobile_ui_v1";
    const PREDICTION_CACHE_KEY = 'wc2026_prediction_cache_v15';
    const SCORE_CACHE_KEY = "wc2026_score_cache_v9";
    const SCORE_REFRESH_MS = 30000;

    // 比赛图片云端配置：不同设备打开时，会从 GitHub Pages 上的公开配置文件读取 Worker 地址和上传密码。
    // 注意：按你的要求 APP_PASSWORD 会放在 config.json 里，方便多设备免配置；这意味着知道页面地址的人也能看到密码。
    const CLOUD_CONFIG_URL = "./worldcup-cloud/config.json";
    const CLOUD_CONFIG_CACHE_KEY = "wc2026_cloud_config_v9";
    const MATCH_IMAGE_CACHE_PREFIX = "wc2026_match_images_v9_";
    const MATCH_IMAGE_DEFAULT_MAX_WIDTH = 1600;
    const MATCH_IMAGE_DEFAULT_QUALITY = 0.82;

    const SCORE_PROXY_BUILDERS = [
      {name:'direct', build:url => url},
      {name:'allorigins', build:url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`},
      {name:'corsproxy', build:url => `https://corsproxy.io/?${encodeURIComponent(url)}`},
      {name:'jina', build:url => `https://r.jina.ai/${url}`}
    ];

    function scoreProxyEndpoint(base){
      const proxy = String(SCORE_PROXY_BASE || '').trim().replace(/\/+$/, '');
      if(!proxy) return base;
      if(base === ESPN_HEADER_SCOREBOARD) return `${proxy}/score/header`;
      if(base === ESPN_SCOREBOARD) return `${proxy}/score/scoreboard`;
      if(base === ESPN_SUMMARY) return `${proxy}/score/summary`;
      return base;
    }
    function buildUrlWithParams(base, data){
      const url = new URL(scoreProxyEndpoint(base));
      Object.keys(data || {}).forEach(k => {
        if(data[k] !== undefined && data[k] !== null) url.searchParams.set(k, data[k]);
      });
      return url.toString();
    }

    function parseScoreJsonResponse(payload){
      if(payload && typeof payload === 'object') return payload;
      const text = String(payload || '').trim();
      if(!text) throw new Error('empty score response');

      try{ return JSON.parse(text); }catch(e){}

      // Jina Reader 会把 JSON 包在 Markdown / 文本里，这里截取第一个 JSON 对象。
      const first = text.indexOf('{');
      const last = text.lastIndexOf('}');
      if(first >= 0 && last > first){
        const possible = text.slice(first, last + 1);
        try{ return JSON.parse(possible); }catch(e){}
      }

      throw new Error('score response is not valid json');
    }

    function fetchScoreJson(base, data, silent=false){
      const target = buildUrlWithParams(base, data);
      const dfd = $.Deferred();
      const useOwnProxy = !!String(SCORE_PROXY_BASE || '').trim();
      const sources = useOwnProxy ? [{name:'cloudflare-worker', build:url => url}] : SCORE_PROXY_BUILDERS;
      let i = 0;

      function next(){
        if(i >= sources.length){
          dfd.reject({message:'all score sources failed', url:target});
          return;
        }

        const source = sources[i++];
        const url = source.build(target);

        $.ajax({
          url,
          dataType:'text',
          timeout:15000,
          cache:false
        }).then(payload => {
          try{
            const data = parseScoreJsonResponse(payload);
            app.scoreSource = source.name;
            dfd.resolve(data);
          }catch(parseErr){
            if(!silent) console.warn('score parse failed', source.name, parseErr);
            next();
          }
        }, err => {
          if(!silent) console.warn('score source failed', source.name, url, err);
          next();
        });
      }

      next();
      return dfd.promise();
    }


    const APP_VERSION = "v15";

    const I18N = {
      zh: {
        htmlLang:"zh-CN",
        title:"2026 世界杯",
        browserTitle:"2026 世界杯赛程 v15",
        pwaAppName:"世界杯2026",
        langZhLabel:"中文",
        langEnLabel:"英文",
        langTrLabel:"土耳其语",
        copied:"链接已复制",
        subline:"主时间会根据设备地区在北京时间和蒙特雷时间之间自动切换，同时显示另一个时间。PC 端和手机端都可以使用。",
        share:"分享",
        install:"添加到主屏幕",
        installTip:"iPhone Safari：点击下方分享按钮，再选择“添加到主屏幕”。从桌面图标打开后，会更像原生 App。",
        schedule:"赛程",
        standing:"积分榜",
        players:"球员榜",
        teams:"球队榜",
        bracket:"晋级图",
        search:"搜索球队 / 城市 / 小组",
        stageAll:"全部阶段",
        teamAll:"全部球队",
        today:"今天",
        tomorrow:"明天",
        upcoming:"未开赛",
        refresh:"刷新数据",
        info:"比分更新时间",
        footer:"数据首次联网加载，成功后自动缓存到本机；正式比赛时间请以国际足联官方为准。",
        loading:"加载赛程中...",
        noData:"没有匹配的比赛",
        noDataHint:"请尝试切换日期、阶段或球队。",
        groupStage:"小组赛",
        r32:"32 强赛",
        r16:"16 强赛",
        qf:"四分之一决赛",
        sf:"半决赛",
        bronze:"季军赛",
        final:"决赛",
        live:"进行中",
        finished:"已结束",
        preview:"比赛前瞻",
        report:"比赛战报",
        liveText:"图文直播",
        scoreUpdating:"比分自动更新中",
        scoreUpdated:"比分更新时间",
        scoreCache:"比分来自缓存",
        scoreNone:"暂无实时比分",
        monterrey:"蒙特雷",
        china:"北京",
        beijing:"北京",
        venue:"比赛城市",
        round:"轮次",
        country:"国家",
        unsupported:"该模块当前先保留样式位，后续需要的话我可以继续补全功能。",
        dataFail:"线上赛程加载失败，且本地没有缓存。请确认网络后再刷新。",
        reset:"重置",
        todayBtn:"只看今天", allDatesBtn:"全部日期",
        allDates:"全部日期",
        allDatesShort:"全部",
        more:"更多", liveNow:"正在比赛", liveCount:"场进行中",
        dataCenter:"数据中心", standingsTitle:"积分榜", standingsHint:"按小组自动汇总胜平负、进球、净胜球和积分；实时比分更新后会同步刷新。",
        allGroups:"全部小组", playedShort:"赛", winShort:"胜", drawShort:"平", lossShort:"负", gfShort:"进", gaShort:"失", gdShort:"净", ptsShort:"分", formShort:"走势",
        rankTitle:"排名", teamHeader:"球队", playerBoardTitle:"球员榜", playerBoardHint:"优先读取实时接口返回的进球事件；没有球员明细时会提示等待数据。", goalsHeader:"进球", assistsHeader:"助攻", matchesHeader:"比赛", playerDataWaiting:"暂无球员明细数据，开赛后如实时接口返回进球球员会自动汇总。",
        teamBoardTitle:"球队榜", teamBoardHint:"综合积分、净胜球、进球数和基础实力生成，方便快速查看当前表现。", ratingHeader:"综合", powerHeader:"实力", rankHeader:"排名",
        bracketTitle:"晋级图", bracketHint:"按淘汰赛赛程自动展示；小组名次会尽量根据当前积分榜解析，未确定时显示占位。", undecided:"待定", winnerOf:"胜者", loserOf:"负者", bestThird:"最佳第3",
        matchImages:"赔率图片", matchImagesHint:"赔率截图按比赛存放到 GitHub；进入赔率页后才加载，不影响首页和前瞻打开速度。", uploadImages:"上传赔率图", refreshImages:"刷新", imageConfigMissing:"图片云端还没有配置，请先修改 worldcup-cloud/config.json。", imageLoading:"图片加载中...", imageEmpty:"本场比赛暂无图片", imageUploadReady:"可一次选择多张图片上传", imageUploading:"正在上传图片...", imageUploadDone:"上传完成", imageUploadFail:"上传失败，请检查 Worker 地址、密码和 GitHub Token。", imageEncodeFail:"图片读取失败；如仍失败，请换 JPG/PNG 图片。", imageLoadFail:"图片加载失败，请检查 Worker 和 GitHub 配置。", imageOpen:"查看图片", imagePrev:"上一张", imageNext:"下一张", imageZoomIn:"放大", imageZoomOut:"缩小", imageReset:"还原", imageClose:"关闭", imageDelete:"删除", imageDeleteConfirm:"确定删除这张图片吗？"
      },
      en: {
        htmlLang:"en",
        title:"World Cup 2026",
        browserTitle:"World Cup 2026 Schedule v15",
        pwaAppName:"World Cup 2026",
        langZhLabel:"Chinese",
        langEnLabel:"English",
        langTrLabel:"Turkish",
        copied:"Link copied",
        subline:"The primary time switches automatically between Beijing and Monterrey based on your device region, while the other time is shown as secondary. The page works on desktop and mobile.",
        share:"Share",
        install:"Add to Home Screen",
        installTip:"On iPhone Safari: tap Share, then choose Add to Home Screen. Launching from the icon will feel more like a native app.",
        schedule:"Schedule",
        standing:"Standings",
        players:"Top Players",
        teams:"Team Ranking",
        bracket:"Bracket",
        search:"Search team / city / group",
        stageAll:"All stages",
        teamAll:"All teams",
        today:"Today",
        tomorrow:"Tomorrow",
        upcoming:"Upcoming",
        refresh:"Refresh",
        info:"Score update time",
        footer:"The schedule is fetched online on first load and then cached locally. Please confirm final kickoff times on the official FIFA site.",
        loading:"Loading schedule...",
        noData:"No matching matches",
        noDataHint:"Try a different date, stage, or team.",
        groupStage:"Group Stage",
        r32:"Round of 32",
        r16:"Round of 16",
        qf:"Quarter-finals",
        sf:"Semi-finals",
        bronze:"Third-place Match",
        final:"Final",
        live:"Live",
        finished:"Finished",
        preview:"Preview",
        report:"Match Report",
        liveText:"Live Text",
        scoreUpdating:"Live scores auto-refreshing",
        scoreUpdated:"Scores updated",
        scoreCache:"Scores from cache",
        scoreNone:"No live score yet",
        monterrey:"Monterrey",
        china:"Beijing",
        beijing:"Beijing",
        venue:"Host city",
        round:"Round",
        country:"Country",
        unsupported:"This tab is currently kept as a styled placeholder. I can build out the full functionality next if you want.",
        dataFail:"The remote schedule could not be loaded and no local cache is available. Please check your network and refresh.",
        reset:"Reset",
        todayBtn:"Today only", allDatesBtn:"All dates",
        allDates:"All dates",
        allDatesShort:"All",
        more:"More", liveNow:"Live now", liveCount:"live",
        dataCenter:"Data Center", standingsTitle:"Standings", standingsHint:"Group tables are calculated from wins, draws, losses, goals, goal difference and points. They refresh with live scores.",
        allGroups:"All groups", playedShort:"P", winShort:"W", drawShort:"D", lossShort:"L", gfShort:"GF", gaShort:"GA", gdShort:"GD", ptsShort:"Pts", formShort:"Form",
        rankTitle:"Rank", teamHeader:"Team", playerBoardTitle:"Top Players", playerBoardHint:"Goal events are read from the live feed when available. If player details are not returned yet, this page shows a waiting notice.", goalsHeader:"Goals", assistsHeader:"Assists", matchesHeader:"Matches", playerDataWaiting:"No player detail is available yet. Once the live feed returns scorers, they will be summarized automatically.",
        teamBoardTitle:"Team Ranking", teamBoardHint:"Ranking combines points, goal difference, goals scored and baseline team strength.", ratingHeader:"Rating", powerHeader:"Power", rankHeader:"Rank",
        bracketTitle:"Bracket", bracketHint:"Knockout fixtures are shown automatically. Group placeholders are resolved from current standings when possible.", undecided:"TBD", winnerOf:"Winner", loserOf:"Loser", bestThird:"Best 3rd",
        matchImages:"Odds Images", matchImagesHint:"Odds screenshots are stored on GitHub by match and loaded only after you open the Odds tab.", uploadImages:"Upload odds", refreshImages:"Refresh", imageConfigMissing:"Cloud image storage is not configured. Please edit worldcup-cloud/config.json first.", imageLoading:"Loading images...", imageEmpty:"No images for this match yet", imageUploadReady:"Select multiple images at once", imageUploading:"Uploading images...", imageUploadDone:"Upload complete", imageUploadFail:"Upload failed. Check Worker URL, password and GitHub token.", imageEncodeFail:"Image reading failed. Please try another image format if upload still fails.", imageLoadFail:"Could not load images. Check Worker and GitHub settings.", imageOpen:"View image", imagePrev:"Previous", imageNext:"Next", imageZoomIn:"Zoom in", imageZoomOut:"Zoom out", imageReset:"Reset", imageClose:"Close", imageDelete:"Delete", imageDeleteConfirm:"Delete this image?"
      },
      tr: {
        htmlLang:"tr",
        title:"2026 Dünya Kupası",
        browserTitle:"2026 Dünya Kupası Programı v15",
        pwaAppName:"Dünya Kupası 2026",
        langZhLabel:"Çince",
        langEnLabel:"İngilizce",
        langTrLabel:"Türkçe",
        copied:"Bağlantı kopyalandı",
        subline:"Ana saat, cihaz bölgenize göre Pekin ve Monterrey arasında otomatik değişir; diğer saat ikinci olarak gösterilir. Sayfa masaüstü ve mobilde çalışır.",
        share:"Paylaş",
        install:"Ana Ekrana Ekle",
        installTip:"iPhone Safari: alttaki paylaş düğmesine dokunun, ardından Ana Ekrana Ekle seçeneğini seçin. Simge üzerinden açıldığında uygulama gibi çalışır.",
        schedule:"Program",
        standing:"Puan Durumu",
        players:"Oyuncu Sıralaması",
        teams:"Takım Sıralaması",
        bracket:"Eleme Ağacı",
        search:"Takım / şehir / grup ara",
        stageAll:"Tüm aşamalar",
        teamAll:"Tüm takımlar",
        today:"Bugün",
        tomorrow:"Yarın",
        upcoming:"Başlamadı",
        refresh:"Verileri Yenile",
        info:"Skor güncelleme zamanı",
        footer:"Program ilk açılışta çevrim içi yüklenir ve başarılı olursa cihaza kaydedilir. Resmî başlama saatleri için FIFA duyurularını kontrol edin.",
        loading:"Program yükleniyor...",
        noData:"Eşleşen maç yok",
        noDataHint:"Başka bir tarih, aşama veya takım seçmeyi deneyin.",
        groupStage:"Grup Aşaması",
        r32:"Son 32",
        r16:"Son 16",
        qf:"Çeyrek Final",
        sf:"Yarı Final",
        bronze:"Üçüncülük Maçı",
        final:"Final",
        live:"Canlı",
        finished:"Bitti",
        preview:"Maç Öncesi",
        report:"Maç Raporu",
        liveText:"Canlı Anlatım",
        scoreUpdating:"Skor otomatik güncelleniyor",
        scoreUpdated:"Skor güncellendi",
        scoreCache:"Skor önbellekten",
        scoreNone:"Henüz canlı skor yok",
        monterrey:"Monterrey",
        china:"Pekin",
        beijing:"Pekin",
        venue:"Ev sahibi şehir",
        round:"Tur",
        country:"Ülke",
        unsupported:"Bu sekme şimdilik tasarım yer tutucusu olarak bırakıldı.",
        dataFail:"Çevrim içi program yüklenemedi ve yerel önbellek bulunamadı. Lütfen ağ bağlantısını kontrol edip yenileyin.",
        reset:"Sıfırla",
        todayBtn:"Sadece bugün", allDatesBtn:"Tüm tarihler",
        allDates:"Tüm tarihler",
        allDatesShort:"Tümü",
        more:"Daha fazla", liveNow:"Canlı maçlar", liveCount:"canlı",
        dataCenter:"Veri Merkezi", standingsTitle:"Puan Durumu", standingsHint:"Grup tabloları galibiyet, beraberlik, mağlubiyet, goller, averaj ve puana göre otomatik hesaplanır.",
        allGroups:"Tüm gruplar", playedShort:"O", winShort:"G", drawShort:"B", lossShort:"M", gfShort:"AG", gaShort:"YG", gdShort:"AV", ptsShort:"P", formShort:"Form",
        rankTitle:"Sıra", teamHeader:"Takım", playerBoardTitle:"Oyuncu Sıralaması", playerBoardHint:"Canlı veri gol olaylarını döndürdüğünde oyuncu istatistikleri otomatik özetlenir.", goalsHeader:"Gol", assistsHeader:"Asist", matchesHeader:"Maç", playerDataWaiting:"Henüz oyuncu detayı yok. Canlı veri golcüleri döndürdüğünde otomatik listelenecek.",
        teamBoardTitle:"Takım Sıralaması", teamBoardHint:"Sıralama puan, averaj, atılan gol ve temel takım gücünü birlikte değerlendirir.", ratingHeader:"Puan", powerHeader:"Güç", rankHeader:"Sıra",
        bracketTitle:"Eleme Ağacı", bracketHint:"Eleme maçları otomatik gösterilir; grup yer tutucuları mümkün olduğunda güncel puan durumundan çözülür.", undecided:"Belli değil", winnerOf:"Kazanan", loserOf:"Kaybeden", bestThird:"En iyi 3.",
        matchImages:"Oran Görselleri", matchImagesHint:"Oran ekran görüntüleri maç bazında GitHub üzerinde saklanır ve yalnızca Oran sekmesi açılınca yüklenir.", uploadImages:"Oran görseli yükle", refreshImages:"Yenile", imageConfigMissing:"Bulut görsel depolama yapılandırılmadı. Lütfen önce worldcup-cloud/config.json dosyasını düzenleyin.", imageLoading:"Görseller yükleniyor...", imageEmpty:"Bu maç için henüz görsel yok", imageUploadReady:"Birden fazla görsel seçebilirsiniz", imageUploading:"Görseller yükleniyor...", imageUploadDone:"Yükleme tamamlandı", imageUploadFail:"Yükleme başarısız. Worker adresi, parola ve GitHub tokenı kontrol edin.", imageEncodeFail:"Görsel okunamadı. Hâlâ başarısızsa JPG/PNG deneyin.", imageLoadFail:"Görseller yüklenemedi. Worker ve GitHub ayarlarını kontrol edin.", imageOpen:"Görseli görüntüle", imagePrev:"Önceki", imageNext:"Sonraki", imageZoomIn:"Yakınlaştır", imageZoomOut:"Uzaklaştır", imageReset:"Sıfırla", imageClose:"Kapat", imageDelete:"Sil", imageDeleteConfirm:"Bu görsel silinsin mi?"
      }
    };


    const PRED_I18N = {
      zh:{
        predictMatch:"预测比赛", actualScore:"实际比分", previewTab:"前瞻", liveTab:"赔率", aiTitle:"智能预测",
        winPrediction:"胜率预测", homeWin:"主胜", awayWin:"客胜", draw:"平局", favoredDirection:"更看好", mainPick:"主推", secondPick:"次选", upsetWatch:"防冷", drawGuard:"防平", topTwo:"主推2个", coldThree:"防冷3个", leadingNow:"当前领先", finalResult:"最终结果",
        normalScores:"主推比分", upsetScores:"防冷比分", aiConclusion:"AI预测", moreAnalysis:"更多分析", reasonOne:"关键判断", coreFactors:"核心因素", worldRank:"近四届世界杯排名", rankLabel:"近四届排名", strengthLabel:"实力", venueLabel:"场地", fifaRankNote:"",
        modelScore:"模型评分", attack:"进攻倾向", defense:"防守稳定", venue:"比赛环境",
        recent:"近期走势", tactic:"战术倾向", risk:"爆冷风险", lineup:"预测阵型",
        tableTitle:"小组参考", team:"球队", winRate:"胜率", score:"比分", point:"分",
        disclaimer:"该预测由本地模型根据球队强弱、比赛时间、赛地和赛程状态生成；预测比分生成后会锁定，不会因开赛或赛后比分而改写，仅供娱乐参考，不代表官方结果。",
        outlook:function(a,b,fav,score){return `模型综合双方实力、赛地因素和比赛状态后，当前更看好 ${fav}。最可能比分可优先参考 ${score}，但杯赛存在爆冷可能。`;},
        liveSoon:"直播页已接入当前比分和事件。"
      },
      en:{
        predictMatch:"Predict Match", actualScore:"Actual Score", previewTab:"Preview", liveTab:"Odds", aiTitle:"AI Prediction",
        winPrediction:"Win Probability", homeWin:"Home", awayWin:"Away", draw:"Draw", favoredDirection:"Favored side", mainPick:"Main", secondPick:"Alt", upsetWatch:"Upset", drawGuard:"Draw", topTwo:"Top 2 picks", coldThree:"3 hedge picks", leadingNow:"Leading now", finalResult:"Final result",
        normalScores:"Main score picks", upsetScores:"Upset protection", aiConclusion:"AI Prediction", moreAnalysis:"More analysis", reasonOne:"Key logic", coreFactors:"Key factors", worldRank:"Recent World Cup ranks", rankLabel:"Recent WCs", strengthLabel:"Strength", venueLabel:"Venue", fifaRankNote:"",
        modelScore:"Model rating", attack:"Attack trend", defense:"Defensive stability", venue:"Match context",
        recent:"Recent trend", tactic:"Tactical trend", risk:"Upset risk", lineup:"Projected shape",
        tableTitle:"Group reference", team:"Team", winRate:"Win rate", score:"Score", point:"Pts",
        disclaimer:"This prediction is generated locally from team strength, kickoff time, venue and schedule status. Score picks are locked once generated and are not rewritten by live or final scores. It is for entertainment only and is not an official result.",
        outlook:function(a,b,fav,score){return `After weighing team strength, venue context and match status, the model leans toward ${fav}. The highest-probability score pick is ${score}, but an upset is still possible in tournament football.`;},
        liveSoon:"Live score and event view is connected."
      },
      tr:{
        predictMatch:"Maçı Tahmin Et", actualScore:"Gerçek Skor", previewTab:"Ön izleme", liveTab:"Oran", aiTitle:"Yapay Zekâ Tahmini",
        winPrediction:"Kazanma Olasılığı", homeWin:"Ev", awayWin:"Deplasman", draw:"Beraberlik", favoredDirection:"Öne çıkan taraf", mainPick:"Ana", secondPick:"2. tercih", upsetWatch:"Sürpriz", drawGuard:"Beraberlik", topTwo:"En iyi 2 skor", coldThree:"3 sürpriz skor", leadingNow:"Şu an önde", finalResult:"Nihai sonuç",
        normalScores:"Ana skorlar", upsetScores:"Sürpriz koruması", aiConclusion:"Yapay Zekâ Tahmini", moreAnalysis:"Daha fazla analiz", reasonOne:"Ana mantık", coreFactors:"Temel faktörler", worldRank:"Son Dünya Kupası sıraları", rankLabel:"Son DK", strengthLabel:"Güç", venueLabel:"Saha", fifaRankNote:"",
        modelScore:"Model puanı", attack:"Hücum eğilimi", defense:"Savunma dengesi", venue:"Maç ortamı",
        recent:"Son eğilim", tactic:"Taktik eğilim", risk:"Sürpriz riski", lineup:"Tahmini diziliş",
        tableTitle:"Grup referansı", team:"Takım", winRate:"Kazanma", score:"Skor", point:"Puan",
        disclaimer:"Bu tahmin; takım gücü, başlama saati, saha ve fikstür durumuna göre yerel model tarafından üretilir. Skor önerileri üretildikten sonra kilitlenir; canlı veya final skoruyla değiştirilmez. Yalnızca eğlence amaçlıdır, resmî sonuç değildir.",
        outlook:function(a,b,fav,score){return `Model takım gücü, saha koşulları ve maç durumunu birlikte değerlendirince ${fav} tarafını biraz önde görüyor. En olası skor önerisi ${score}, ancak turnuva maçlarında sürpriz ihtimali vardır.`;},
        liveSoon:"Canlı skor ve olay görünümü bağlandı."
      }
    };
    function pt(key){const dict=PRED_I18N[app.lang]||PRED_I18N.en; return dict[key] || PRED_I18N.en[key] || key;}

    const TEAM_ZH = {
      "Mexico":"墨西哥","South Africa":"南非","South Korea":"韩国","Czech Republic":"捷克","Canada":"加拿大","Bosnia & Herzegovina":"波黑","Qatar":"卡塔尔","Switzerland":"瑞士","Brazil":"巴西","Morocco":"摩洛哥","Haiti":"海地","Scotland":"苏格兰","USA":"美国","Paraguay":"巴拉圭","Australia":"澳大利亚","Turkey":"土耳其","Germany":"德国","Curaçao":"库拉索","Ivory Coast":"科特迪瓦","Ecuador":"厄瓜多尔","Netherlands":"荷兰","Japan":"日本","Sweden":"瑞典","Tunisia":"突尼斯","Belgium":"比利时","Egypt":"埃及","Iran":"伊朗","New Zealand":"新西兰","Spain":"西班牙","Cape Verde":"佛得角","Saudi Arabia":"沙特阿拉伯","Uruguay":"乌拉圭","France":"法国","Senegal":"塞内加尔","Iraq":"伊拉克","Norway":"挪威","Argentina":"阿根廷","Algeria":"阿尔及利亚","Austria":"奥地利","Jordan":"约旦","Portugal":"葡萄牙","DR Congo":"刚果（金）","Uzbekistan":"乌兹别克斯坦","Colombia":"哥伦比亚","England":"英格兰","Croatia":"克罗地亚","Ghana":"加纳","Panama":"巴拿马"
    };
    const GROUND_ZH = {
      "Mexico City":"墨西哥城","Guadalajara (Zapopan)":"瓜达拉哈拉 / 萨波潘","Monterrey (Guadalupe)":"蒙特雷 / 瓜达卢佩","Toronto":"多伦多","Vancouver":"温哥华","Seattle":"西雅图","Los Angeles (Inglewood)":"洛杉矶 / 英格尔伍德","San Francisco Bay Area (Santa Clara)":"旧金山湾区 / 圣克拉拉","New York/New Jersey (East Rutherford)":"纽约 / 新泽西","Boston (Foxborough)":"波士顿 / 福克斯堡","Philadelphia":"费城","Miami (Miami Gardens)":"迈阿密","Atlanta":"亚特兰大","Houston":"休斯敦","Dallas (Arlington)":"达拉斯 / 阿灵顿","Kansas City":"堪萨斯城"
    };
    const TEAM_TR = {
      "Mexico":"Meksika","South Africa":"Güney Afrika","South Korea":"Güney Kore","Czech Republic":"Çekya","Canada":"Kanada","Bosnia & Herzegovina":"Bosna-Hersek","Qatar":"Katar","Switzerland":"İsviçre","Brazil":"Brezilya","Morocco":"Fas","Haiti":"Haiti","Scotland":"İskoçya","USA":"ABD","Paraguay":"Paraguay","Australia":"Avustralya","Turkey":"Türkiye","Germany":"Almanya","Curaçao":"Curaçao","Ivory Coast":"Fildişi Sahili","Ecuador":"Ekvador","Netherlands":"Hollanda","Japan":"Japonya","Sweden":"İsveç","Tunisia":"Tunus","Belgium":"Belçika","Egypt":"Mısır","Iran":"İran","New Zealand":"Yeni Zelanda","Spain":"İspanya","Cape Verde":"Yeşil Burun Adaları","Saudi Arabia":"Suudi Arabistan","Uruguay":"Uruguay","France":"Fransa","Senegal":"Senegal","Iraq":"Irak","Norway":"Norveç","Argentina":"Arjantin","Algeria":"Cezayir","Austria":"Avusturya","Jordan":"Ürdün","Portugal":"Portekiz","DR Congo":"Kongo DC","Uzbekistan":"Özbekistan","Colombia":"Kolombiya","England":"İngiltere","Croatia":"Hırvatistan","Ghana":"Gana","Panama":"Panama"
    };
    const GROUND_TR = {
      "Mexico City":"Meksiko","Guadalajara (Zapopan)":"Guadalajara / Zapopan","Monterrey (Guadalupe)":"Monterrey / Guadalupe","Toronto":"Toronto","Vancouver":"Vancouver","Seattle":"Seattle","Los Angeles (Inglewood)":"Los Angeles / Inglewood","San Francisco Bay Area (Santa Clara)":"San Francisco Körfez Bölgesi / Santa Clara","New York/New Jersey (East Rutherford)":"New York / New Jersey","Boston (Foxborough)":"Boston / Foxborough","Philadelphia":"Philadelphia","Miami (Miami Gardens)":"Miami","Atlanta":"Atlanta","Houston":"Houston","Dallas (Arlington)":"Dallas / Arlington","Kansas City":"Kansas City"
    };
    const TEAM_CODE = {
      "Mexico":"mx","South Africa":"za","South Korea":"kr","Czech Republic":"cz","Canada":"ca","Bosnia & Herzegovina":"ba","Qatar":"qa","Switzerland":"ch","Brazil":"br","Morocco":"ma","Haiti":"ht","Scotland":"gb-sct","USA":"us","Paraguay":"py","Australia":"au","Turkey":"tr","Germany":"de","Curaçao":"cw","Ivory Coast":"ci","Ecuador":"ec","Netherlands":"nl","Japan":"jp","Sweden":"se","Tunisia":"tn","Belgium":"be","Egypt":"eg","Iran":"ir","New Zealand":"nz","Spain":"es","Cape Verde":"cv","Saudi Arabia":"sa","Uruguay":"uy","France":"fr","Senegal":"sn","Iraq":"iq","Norway":"no","Argentina":"ar","Algeria":"dz","Austria":"at","Jordan":"jo","Portugal":"pt","DR Congo":"cd","Uzbekistan":"uz","Colombia":"co","England":"gb-eng","Croatia":"hr","Ghana":"gh","Panama":"pa"
    };


    const TEAM_POWER = {
      "Argentina":94,"France":93,"Spain":92,"Brazil":91,"England":90,"Portugal":89,"Germany":88,"Netherlands":87,
      "Belgium":84,"Croatia":83,"Uruguay":83,"Morocco":82,"Japan":81,"USA":80,"Mexico":79,"Switzerland":79,
      "South Korea":78,"Senegal":78,"Austria":77,"Colombia":80,"Ecuador":78,"Canada":76,"Turkey":78,"Sweden":78,
      "Norway":78,"Australia":75,"Iran":75,"Qatar":72,"Saudi Arabia":73,"Tunisia":73,"Egypt":76,"Algeria":75,
      "South Africa":70,"Czech Republic":76,"Paraguay":74,"Ivory Coast":76,"Scotland":74,"Ghana":73,"Panama":70,
      "New Zealand":68,"Haiti":66,"Cape Verde":68,"Iraq":68,"Jordan":67,"Uzbekistan":70,"DR Congo":70,
      "Bosnia & Herzegovina":72,"Curaçao":65
    };

    // FIFA/Coca-Cola Men's World Ranking
    // Source version: FIFA official update 2026-06-11. Next official update: 2026-07-20.
    const TEAM_WORLD_RANK = {
      "Argentina":1,
      "Spain":2,
      "France":3,
      "England":4,
      "Portugal":5,
      "Brazil":6,
      "Morocco":7,
      "Netherlands":8,
      "Belgium":9,
      "Germany":10,
      "Croatia":11,
      "Colombia":13,
      "Mexico":14,
      "Senegal":15,
      "Uruguay":16,
      "USA":17,
      "United States":17,
      "Japan":18,
      "Switzerland":19,
      "Iran":20,
      "Turkey":22,
      "Türkiye":22,
      "Ecuador":23,
      "Austria":24,
      "South Korea":25,
      "Korea Republic":25,
      "Australia":27,
      "Algeria":28,
      "Egypt":29,
      "Canada":30,
      "Norway":31,
      "Ivory Coast":33,
      "Côte d'Ivoire":33,
      "Panama":34,
      "Sweden":38,
      "Paraguay":40,
      "Czech Republic":41,
      "Czechia":41,
      "Scotland":42,
      "DR Congo":45,
      "Tunisia":46,
      "Uzbekistan":51,
      "Qatar":56,
      "Iraq":56,
      "South Africa":60,
      "Saudi Arabia":61,
      "Jordan":63,
      "Bosnia & Herzegovina":64,
      "Bosnia-Herzegovina":64,
      "Cape Verde":67,
      "Cabo Verde":67,
      "Ghana":73,
      "Curaçao":82,
      "Curacao":82,
      "Haiti":83,
      "New Zealand":85
    };

    // Recent FIFA World Cup final standings. Display only, not used to rewrite locked score predictions.
    const TEAM_WORLD_CUP_RANK_HISTORY = {
      2022: {
        "Argentina":1,"France":2,"Croatia":3,"Morocco":4,"Netherlands":5,"England":6,"Brazil":7,"Portugal":8,
        "Japan":9,"Senegal":10,"Australia":11,"Switzerland":12,"Spain":13,"USA":14,"United States":14,"South Korea":16,"Korea Republic":16,
        "Germany":17,"Ecuador":18,"Uruguay":20,"Tunisia":21,"Mexico":22,"Belgium":23,"Ghana":24,"Saudi Arabia":25,
        "Iran":26,"Canada":31,"Qatar":32
      },
      2018: {
        "France":1,"Croatia":2,"Belgium":3,"England":4,"Uruguay":5,"Brazil":6,"Sweden":7,"Colombia":9,
        "Spain":10,"Mexico":12,"Portugal":13,"Switzerland":14,"Japan":15,"Argentina":16,"Senegal":17,"Iran":18,
        "South Korea":19,"Korea Republic":19,"Germany":22,"Tunisia":24,"Saudi Arabia":26,"Morocco":27,"Australia":30,
        "Egypt":31,"Panama":32
      },
      2014: {
        "Germany":1,"Argentina":2,"Netherlands":3,"Brazil":4,"Colombia":5,"Belgium":6,"France":7,"Mexico":10,
        "Switzerland":11,"Uruguay":12,"Algeria":14,"USA":15,"United States":15,"Ecuador":17,"Portugal":18,"Croatia":19,
        "Bosnia & Herzegovina":20,"Bosnia-Herzegovina":20,"Ivory Coast":21,"Côte d'Ivoire":21,"Spain":23,
        "Ghana":25,"England":26,"South Korea":27,"Korea Republic":27,"Iran":28,"Japan":29,"Australia":30
      },
      2010: {
        "Spain":1,"Netherlands":2,"Germany":3,"Uruguay":4,"Argentina":5,"Brazil":6,"Ghana":7,"Paraguay":8,
        "Japan":9,"Portugal":11,"USA":12,"United States":12,"England":13,"Mexico":14,"South Korea":15,"Korea Republic":15,
        "Ivory Coast":17,"Côte d'Ivoire":17,"Switzerland":19,"South Africa":20,"Australia":21,"New Zealand":22,
        "Algeria":28,"France":29
      }
    };
    const WORLD_CUP_RANK_YEARS = [2022, 2018, 2014, 2010];




    // ESPN eventId 兜底映射：当 scoreboard 日期接口拿不到实时比分时，按比赛 ID 直接查 summary。
    const ESPN_EVENT_ID_BY_MATCH = {
      "australia|turkey":"760421",
      "turkey|australia":"760421",
      "brazil|morocco":"760419",
      "morocco|brazil":"760419",
      "haiti|scotland":"760418",
      "scotland|haiti":"760418",
      "qatar|switzerland":"760420",
      "switzerland|qatar":"760420",
      "usa|paraguay":"66456940",
      "paraguay|usa":"66456940",
      "canada|bosnia & herzegovina":"66456916",
      "bosnia & herzegovina|canada":"66456916",
      "mexico|south africa":"66456904",
      "south africa|mexico":"66456904",
      "south korea|czech republic":"66456906",
      "czech republic|south korea":"66456906"
    };

    const TEAM_ALIASES = {
      "czechia":"czech republic",
      "united states":"usa",
      "u.s.":"usa",
      "cote d'ivoire":"ivory coast",
      "côte d'ivoire":"ivory coast",
      "congo dr":"dr congo",
      "congo, dr":"dr congo",
      "democratic republic of congo":"dr congo",
      "bosnia-herzegovina":"bosnia & herzegovina",
      "bosnia and herzegovina":"bosnia & herzegovina",
      "curacao":"curaçao",
      "korea republic":"south korea",
      "korea republic of":"south korea",
      "türkiye":"turkey",
      "turkiye":"turkey",
      "tuerkiye":"turkey",
      "tur":"turkey",
      "turkey":"turkey",
      "aus":"australia",
      "australia":"australia"
    };


    const IMPORTED_SCORE_PREDICTIONS = {"2026-06-11|A|mexico|south africa":{"normal":["2-0","1-0"],"upset":["1-1","0-0","1-2"]},"2026-06-11|A|south korea|czech republic":{"normal":["2-1","1-1"],"upset":["0-1","1-2","2-2"]},"2026-06-12|B|canada|bosnia & herzegovina":{"normal":["1-1","1-0"],"upset":["0-1","2-2","1-2"]},"2026-06-12|D|usa|paraguay":{"normal":["3-0","2-0"],"upset":["2-1","1-1","1-2"]},"2026-06-13|B|qatar|switzerland":{"normal":["0-2","1-2"],"upset":["1-1","1-0","2-2"]},"2026-06-13|C|brazil|morocco":{"normal":["2-1","1-0"],"upset":["1-1","0-1","2-2"]},"2026-06-13|C|haiti|scotland":{"normal":["0-2","1-2"],"upset":["1-1","1-0","2-2"]},"2026-06-14|D|australia|turkey":{"normal":["1-2","1-1"],"upset":["2-1","0-0","2-2"]},"2026-06-14|E|germany|curaçao":{"normal":["4-0","3-0"],"upset":["2-1","1-1","0-0"]},"2026-06-14|F|netherlands|japan":{"normal":["2-1","1-1"],"upset":["1-2","0-1","2-2"]},"2026-06-14|E|ivory coast|ecuador":{"normal":["1-1","1-2"],"upset":["2-1","0-0","2-2"]},"2026-06-14|F|sweden|tunisia":{"normal":["1-0","2-0"],"upset":["1-1","0-1","2-2"]},"2026-06-15|H|spain|cape verde":{"normal":["3-0","4-0"],"upset":["2-1","1-1","0-0"]},"2026-06-15|G|belgium|egypt":{"normal":["2-1","2-0"],"upset":["1-1","1-2","0-0"]},"2026-06-15|H|saudi arabia|uruguay":{"normal":["0-2","1-2"],"upset":["1-1","2-1","0-0"]},"2026-06-15|G|iran|new zealand":{"normal":["1-0","2-0"],"upset":["1-1","0-1","2-2"]},"2026-06-16|I|france|senegal":{"normal":["2-1","1-0"],"upset":["1-1","0-1","2-2"]},"2026-06-16|I|iraq|norway":{"normal":["0-2","1-2"],"upset":["1-1","2-1","0-0"]},"2026-06-16|J|argentina|algeria":{"normal":["2-0","2-1"],"upset":["1-1","0-1","2-2"]},"2026-06-17|J|austria|jordan":{"normal":["2-0","2-1"],"upset":["1-1","0-1","2-2"]},"2026-06-17|K|portugal|dr congo":{"normal":["2-0","3-1"],"upset":["1-1","0-1","2-2"]},"2026-06-17|L|england|croatia":{"normal":["2-1","1-1"],"upset":["1-2","0-1","2-2"]},"2026-06-17|L|ghana|panama":{"normal":["2-0","2-1"],"upset":["1-1","0-1","2-2"]},"2026-06-17|K|uzbekistan|colombia":{"normal":["0-2","1-2"],"upset":["1-1","2-1","0-0"]},"2026-06-18|A|czech republic|south africa":{"normal":["2-1","1-0"],"upset":["1-1","0-1","2-2"]},"2026-06-18|B|switzerland|bosnia & herzegovina":{"normal":["2-1","1-0"],"upset":["1-1","0-1","2-2"]},"2026-06-18|B|canada|qatar":{"normal":["2-0","2-1"],"upset":["1-1","0-1","1-2"]},"2026-06-18|A|mexico|south korea":{"normal":["2-1","1-1"],"upset":["1-2","0-1","2-2"]},"2026-06-19|D|usa|australia":{"normal":["2-1","2-0"],"upset":["1-1","1-2","0-0"]},"2026-06-19|C|scotland|morocco":{"normal":["1-1","1-2"],"upset":["2-1","0-0","2-2"]},"2026-06-19|C|brazil|haiti":{"normal":["3-0","2-0"],"upset":["2-1","1-1","0-1"]},"2026-06-19|D|turkey|paraguay":{"normal":["2-1","1-1"],"upset":["0-1","1-2","0-0"]},"2026-06-20|F|netherlands|sweden":{"normal":["2-1","1-1"],"upset":["0-1","1-2","0-0"]},"2026-06-20|E|germany|ivory coast":{"normal":["2-0","2-1"],"upset":["1-1","1-2","0-0"]},"2026-06-20|E|ecuador|curaçao":{"normal":["2-0","3-1"],"upset":["1-1","0-1","2-2"]},"2026-06-21|F|tunisia|japan":{"normal":["0-1","0-2"],"upset":["1-1","1-0","2-2"]},"2026-06-21|H|spain|saudi arabia":{"normal":["3-0","2-0"],"upset":["2-1","1-1","0-0"]},"2026-06-21|G|belgium|iran":{"normal":["2-0","2-1"],"upset":["1-1","0-1","0-0"]},"2026-06-21|H|uruguay|cape verde":{"normal":["2-0","3-1"],"upset":["1-1","0-1","2-2"]},"2026-06-21|G|new zealand|egypt":{"normal":["0-2","1-2"],"upset":["1-1","1-0","2-2"]},"2026-06-22|J|argentina|austria":{"normal":["2-1","1-0"],"upset":["1-1","0-1","2-2"]},"2026-06-22|I|france|iraq":{"normal":["3-0","2-0"],"upset":["2-1","1-1","0-0"]},"2026-06-22|I|norway|senegal":{"normal":["1-1","2-1"],"upset":["0-1","1-2","2-2"]},"2026-06-22|J|jordan|algeria":{"normal":["0-1","1-2"],"upset":["1-1","1-0","2-2"]},"2026-06-23|K|portugal|uzbekistan":{"normal":["2-0","3-0"],"upset":["1-1","0-1","2-2"]},"2026-06-23|L|england|ghana":{"normal":["2-0","2-1"],"upset":["1-1","0-1","2-2"]},"2026-06-23|L|panama|croatia":{"normal":["0-2","1-2"],"upset":["1-1","1-0","2-2"]},"2026-06-23|K|colombia|dr congo":{"normal":["2-0","2-1"],"upset":["1-1","0-1","2-2"]},"2026-06-24|B|switzerland|canada":{"normal":["1-1","2-1"],"upset":["0-1","1-2","0-0"]},"2026-06-24|B|bosnia & herzegovina|qatar":{"normal":["2-0","2-1"],"upset":["1-1","0-1","2-2"]},"2026-06-24|C|scotland|brazil":{"normal":["0-2","1-2"],"upset":["1-1","2-1","0-0"]},"2026-06-24|C|morocco|haiti":{"normal":["2-0","2-1"],"upset":["1-1","0-1","2-2"]},"2026-06-24|A|czech republic|mexico":{"normal":["1-2","1-1"],"upset":["2-1","0-0","2-2"]},"2026-06-24|A|south africa|south korea":{"normal":["0-2","1-2"],"upset":["1-1","2-1","0-0"]},"2026-06-25|E|ecuador|germany":{"normal":["1-2","0-2"],"upset":["1-1","2-1","0-0"]},"2026-06-25|E|curaçao|ivory coast":{"normal":["0-2","1-2"],"upset":["1-1","1-0","2-2"]},"2026-06-25|F|tunisia|netherlands":{"normal":["0-2","1-2"],"upset":["1-1","2-1","0-0"]},"2026-06-25|F|japan|sweden":{"normal":["1-1","2-1"],"upset":["0-1","1-2","0-0"]},"2026-06-25|D|turkey|usa":{"normal":["1-2","1-1"],"upset":["2-1","0-0","2-2"]},"2026-06-25|D|paraguay|australia":{"normal":["1-1","2-1"],"upset":["0-1","1-2","0-0"]},"2026-06-26|I|norway|france":{"normal":["1-2","0-2"],"upset":["1-1","2-1","0-0"]},"2026-06-26|I|senegal|iraq":{"normal":["2-0","2-1"],"upset":["1-1","0-1","2-2"]},"2026-06-26|H|uruguay|spain":{"normal":["1-1","1-2"],"upset":["2-1","0-0","2-2"]},"2026-06-26|H|cape verde|saudi arabia":{"normal":["1-1","1-2"],"upset":["2-1","0-0","2-2"]},"2026-06-26|G|new zealand|belgium":{"normal":["0-3","1-3"],"upset":["1-1","1-0","2-2"]},"2026-06-26|G|egypt|iran":{"normal":["1-1","2-1"],"upset":["0-1","1-2","0-0"]},"2026-06-27|L|panama|england":{"normal":["0-3","1-3"],"upset":["1-1","1-0","2-2"]},"2026-06-27|L|croatia|ghana":{"normal":["2-1","1-1"],"upset":["0-1","1-2","0-0"]},"2026-06-27|K|colombia|portugal":{"normal":["1-1","1-2"],"upset":["2-1","0-0","2-2"]},"2026-06-27|K|dr congo|uzbekistan":{"normal":["1-1","1-2"],"upset":["2-1","0-0","2-2"]},"2026-06-27|J|jordan|argentina":{"normal":["0-3","1-3"],"upset":["1-1","1-0","2-2"]},"2026-06-27|J|algeria|austria":{"normal":["1-1","1-2"],"upset":["2-1","0-0","2-2"]}};

    function deviceLang(){
      const lang = (navigator.language || "").toLowerCase();
      if(lang.startsWith("zh")) return "zh";
      if(lang.startsWith("tr")) return "tr";
      return "en";
    }
    function initialLang(){
      const manual = localStorage.getItem("wc2026_lang_manual") === "1";
      const saved = localStorage.getItem("wc2026_lang");
      if(manual && saved && I18N[saved]) return saved;
      return deviceLang();
    }
    function selectedLangLabel(){
      if(app.lang === 'zh') return t('langZhLabel');
      if(app.lang === 'tr') return t('langTrLabel');
      return t('langEnLabel');
    }
    function setPwaAppNameByDevice(){
      const lang = deviceLang();
      const item = I18N[lang] || I18N.en;
      let meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if(!meta){
        meta = document.createElement('meta');
        meta.setAttribute('name', 'apple-mobile-web-app-title');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', item.pwaAppName || item.title);
      const link = document.getElementById('manifestLink') || document.querySelector('link[rel="manifest"]');
      if(link) link.setAttribute('href', `./manifest.${lang}.webmanifest`);
    }
    let deviceTimeZoneCache = '';
    let primaryTimeZoneCache = '';
    function deviceTimeZone(){
      if(deviceTimeZoneCache) return deviceTimeZoneCache;
      try{ deviceTimeZoneCache = Intl.DateTimeFormat().resolvedOptions().timeZone || TZ_MAIN; }catch(e){ deviceTimeZoneCache = TZ_MAIN; }
      return deviceTimeZoneCache;
    }
    function primaryTimeZone(){
      if(primaryTimeZoneCache) return primaryTimeZoneCache;
      const tz = deviceTimeZone();
      if(/^Asia\/(Shanghai|Chongqing|Harbin|Urumqi|Hong_Kong|Macau|Taipei)$/i.test(tz)) primaryTimeZoneCache = TZ_CHINA;
      else if(/^America\/(Monterrey|Mexico_City|Matamoros|Mazatlan|Chihuahua|Merida|Tijuana)$/i.test(tz)) primaryTimeZoneCache = TZ_MAIN;
      else primaryTimeZoneCache = TZ_MAIN;
      return primaryTimeZoneCache;
    }
    function secondaryTimeZone(){
      return primaryTimeZone() === TZ_CHINA ? TZ_MAIN : TZ_CHINA;
    }
    function localeForLang(){
      if(app.lang === 'zh') return 'zh-CN';
      if(app.lang === 'tr') return 'tr-TR';
      return 'en-US';
    }
    function timeZoneLabel(timeZone){
      return timeZone === TZ_CHINA ? t('beijing') : t('monterrey');
    }

    const app = {
      lang: initialLang(),
      matches: [],
      matchItems: [],
      matchesSignature: '',
      controlsReady: false,
      hasRenderedSchedule: false,
      scores: {},
      scoreIndex: {eventId:{}, pair:{}},
      scoreIndexDirty: true,
      scoreCycleChanged: false,
      scoreSource: "none",
      scoreTimer: null,
      scoreFetching: false,
      scoreRefreshRunning: false,
      scheduleFetching: false,
      liveCollapsed: false,
      source: "none",
      activeDate: '__today__',
      todayOnly: false,
      activeTab: "schedule",
      predictionIndex: null,
      predictionTab: "preview",
      predictionLiveLoading: false,
      loadedFlags: new Set(),
      lastForegroundRefreshAt: 0,
      lastDateBarHtml: '',
      lastContentHtml: '',
      lastLivePanelHtml: '',
      flagPreloadJob: 0,
      scoreCount: 0,
      latestScoreUpdatedAt: '',
      textCache: Object.create(null),
      playerEvents: {},
      playerStats: {},
      lastOtherHtml: '',
      cloudConfig: null,
      cloudConfigLoading: null,
      matchImages: {},
      imageViewer: {key:'', index:0, scale:1, x:0, y:0, touch:null}
    };

    function createMatchItem(raw, idx){
      const date = raw && raw._date instanceof Date ? raw._date : parseKickoff(raw);
      const item = {...raw, _idx: idx, _date: date};
      item._stageKey = stageKey(item.round);
      item._pairKey = sortedMatchPairKey(item.team1, item.team2);
      item._eventId = staticEspnEventIdForPair(item.team1, item.team2);
      item._scoreKeys = scoreKeyVariants(date, item.team1, item.team2);
      item._dateKeyMain = dateKey(date, TZ_MAIN);
      item._dateKeyChina = dateKey(date, TZ_CHINA);
      return item;
    }
    function matchItems(){
      return Array.isArray(app.matchItems) ? app.matchItems : [];
    }
    function matchDate(match){
      return match && match._date instanceof Date ? match._date : parseKickoff(match);
    }
    function setHtmlIfChanged($el, html, cacheKey){
      if(app[cacheKey] !== html){
        $el.html(html);
        app[cacheKey] = html;
      }
    }

    function t(key){return (I18N[app.lang] && I18N[app.lang][key]) || I18N.en[key] || I18N.zh[key] || key;}
    function memoText(bucket, key, factory){
      const lang = app.lang || 'zh';
      const root = app.textCache[lang] || (app.textCache[lang] = Object.create(null));
      const cache = root[bucket] || (root[bucket] = Object.create(null));
      const k = String(key ?? '');
      if(Object.prototype.hasOwnProperty.call(cache, k)) return cache[k];
      return cache[k] = factory();
    }
    function esc(s){return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
    function isStandalone(){return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;}
    function teamName(name){
      return memoText('team', name, function(){
        if(!name) return "";
        if(app.lang === 'en') return name;
        let m = String(name).match(/^W(\d+)$/);
        if(m) return app.lang === 'tr' ? `${m[1]}. maçın galibi` : `第${m[1]}场胜者`;
        m = String(name).match(/^L(\d+)$/);
        if(m) return app.lang === 'tr' ? `${m[1]}. maçın mağlubu` : `第${m[1]}场负者`;
        m = String(name).match(/^([12])([A-L])$/);
        if(m) return app.lang === 'tr' ? `${m[2]} Grubu ${m[1]}.` : `${m[2]}组第${m[1]}名`;
        m = String(name).match(/^3([A-L/]+)$/);
        if(m) return app.lang === 'tr' ? `${m[1]} Gruplarının en iyi 3.leri` : `${m[1]}组最佳第3名`;
        if(app.lang === 'tr') return TEAM_TR[name] || name;
        return TEAM_ZH[name] || name;
      });
    }
    function groundName(name){
      return memoText('ground', name, function(){
        if(app.lang === 'zh') return GROUND_ZH[name] || name;
        if(app.lang === 'tr') return GROUND_TR[name] || name;
        return name;
      });
    }
    function groundCountryName(name){
      return memoText('groundCountry', name, function(){
        const s = String(name || '');
        if(/Mexico City|Guadalajara|Monterrey/.test(s)) return app.lang === 'zh' ? '墨西哥' : (app.lang === 'tr' ? 'Meksika' : 'Mexico');
        if(/Toronto|Vancouver/.test(s)) return app.lang === 'zh' ? '加拿大' : (app.lang === 'tr' ? 'Kanada' : 'Canada');
        if(s) return app.lang === 'zh' ? '美国' : (app.lang === 'tr' ? 'ABD' : 'USA');
        return '';
      });
    }
    function groupLabel(group){
      return memoText('group', group, function(){
        if(!group) return '';
        const m = String(group).match(/^Group\s+([A-L])$/i);
        if(!m) return group;
        if(app.lang === 'zh') return `${m[1]}组`;
        if(app.lang === 'tr') return `${m[1]} Grubu`;
        return group;
      });
    }
    function normalizeTeam(name){
      const raw = String(name || '').trim().toLowerCase();
      const plain = raw.normalize ? raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : raw;
      return TEAM_ALIASES[raw] || TEAM_ALIASES[plain] || plain;
    }
    function scoreKeyVariants(dateLike, teamA, teamB){
      const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
      const names = [normalizeTeam(teamA), normalizeTeam(teamB)].sort();
      if(isNaN(date.getTime())) return [];
      const set = new Set();
      [-24, -12, 0, 12, 24].forEach(h => {
        const d = new Date(date.getTime() + h * 60 * 60 * 1000);
        [TZ_MAIN, ESPN_SCORE_TZ].forEach(tz => {
          const kd = dateKey(d, tz);
          set.add(`${kd}|${names[0]}|${names[1]}`);
        });
      });
      return [...set];
    }
    function yyyymmddFromKey(key){ return String(key || '').replaceAll('-', ''); }
    function addScoreFetchDateKeys(set, dateLike){
      const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
      if(isNaN(date.getTime())) return;
      const offsets = [-12, 0, 12].map(h => new Date(date.getTime() + h * 60 * 60 * 1000));
      offsets.forEach(d => {
        set.add(dateKey(d, TZ_MAIN));
        set.add(dateKey(d, ESPN_SCORE_TZ));
      });
    }
    function uniqueVisibleDateKeys(){
      const keys = new Set();
      const visible = filteredMatches();
      const now = new Date();

      // 关键修复：页面日期按蒙特雷/北京显示，但 ESPN 比分接口按美东日期归档。
      // 比如蒙特雷 06.13 晚上的比赛，在 ESPN 可能属于 06.14。
      if(app.activeDate === 'all'){
        addScoreFetchDateKeys(keys, now);
        matchItems().forEach(m => {
          const d = matchDate(m);
          if(Math.abs(d.getTime() - now.getTime()) <= 36 * 60 * 60 * 1000){
            addScoreFetchDateKeys(keys, d);
          }
        });
      }else{
        visible.forEach(m => addScoreFetchDateKeys(keys, m._date));
      }

      if(!keys.size){
        addScoreFetchDateKeys(keys, now);
      }

      return [...keys].slice(0, 10);
    }
    function saveScoreCache(){
      try{ localStorage.setItem(SCORE_CACHE_KEY, JSON.stringify({updatedAt:new Date().toISOString(), scores:app.scores, playerEvents:app.playerEvents})); }catch(e){}
    }
    function refreshScoreMeta(){
      const vals = Object.values(app.scores || {});
      app.scoreCount = vals.length;
      app.latestScoreUpdatedAt = vals.map(x => x && x.updatedAt).filter(Boolean).sort().pop() || '';
    }
    function loadScoreCache(){
      try{
        const raw = localStorage.getItem(SCORE_CACHE_KEY);
        if(!raw) return;
        const data = JSON.parse(raw);
        app.scores = data.scores || {};
        app.playerEvents = data.playerEvents || {};
        rebuildPlayerStats();
        app.scoreSource = 'cache';
        refreshScoreMeta();
        markScoresChanged();
      }catch(e){}
    }
    function scoreComparable(s){
      if(!s) return '';
      return JSON.stringify({
        home: normalizeTeam(s.home),
        away: normalizeTeam(s.away),
        homeScore: String(s.homeScore ?? ''),
        awayScore: String(s.awayScore ?? ''),
        state: String(s.state || ''),
        completed: !!s.completed,
        detail: String(s.detail || ''),
        clock: String(s.clock || ''),
        eventId: String(s.eventId || '')
      });
    }
    function markScoresChanged(){
      app.scoreIndexDirty = true;
      app.scoreCycleChanged = true;
    }
    function mergeScoreMaps(){
      let changed = false;
      Array.from(arguments).forEach(map => {
        Object.keys(map || {}).forEach(key => {
          const next = map[key];
          const prev = app.scores[key];
          if(!prev || scoreComparable(prev) !== scoreComparable(next)){
            if(!prev) app.scoreCount += 1;
            app.scores[key] = next;
            if(next && next.updatedAt && String(next.updatedAt) > String(app.latestScoreUpdatedAt || '')) app.latestScoreUpdatedAt = next.updatedAt;
            changed = true;
          }
        });
      });
      if(changed) markScoresChanged();
      return changed;
    }

    function playerEventKey(ev){
      return [ev.eventId || '', ev.matchKey || '', ev.team || '', ev.player || '', ev.minute || '', ev.kind || 'goal'].join('|');
    }
    function rebuildPlayerStats(){
      const stats = {};
      Object.values(app.playerEvents || {}).forEach(ev => {
        if(!ev || !ev.player) return;
        const key = normalizeTeam(ev.player || '') + '|' + normalizeTeam(ev.team || '');
        const row = stats[key] || (stats[key] = {
          player: ev.player,
          team: ev.team,
          goals: 0,
          assists: 0,
          matches: new Set(),
          latestAt: ''
        });
        if(ev.kind === 'assist') row.assists += 1;
        else row.goals += 1;
        if(ev.matchKey) row.matches.add(ev.matchKey);
        if(ev.updatedAt && String(ev.updatedAt) > String(row.latestAt || '')) row.latestAt = ev.updatedAt;
      });
      Object.keys(stats).forEach(k => { stats[k].matches = stats[k].matches.size; });
      app.playerStats = stats;
    }
    function mergePlayerEvents(events){
      let changed = false;
      (events || []).forEach(ev => {
        if(!ev || !ev.player) return;
        const key = playerEventKey(ev);
        if(!app.playerEvents[key]){
          app.playerEvents[key] = ev;
          changed = true;
        }
      });
      if(changed){ rebuildPlayerStats(); app.scoreCycleChanged = true; }
      return changed;
    }
    function readDisplayName(obj){
      return obj && (obj.displayName || obj.fullName || obj.name || obj.shortDisplayName || obj.abbreviation) || '';
    }
    function extractScoringPlayerName(play){
      const pools = [play && play.athletes, play && play.participants, play && play.players, play && play.scorers];
      for(const arr of pools){
        if(Array.isArray(arr)){
          for(const item of arr){
            const name = readDisplayName(item && (item.athlete || item.player || item));
            if(name) return name;
          }
        }
      }
      return readDisplayName(play && (play.athlete || play.player || play.scorer));
    }
    function extractPlayerEventsFromEspn(data){
      const events = [];
      const seen = new Set();
      function walk(node, parent){
        if(!node || typeof node !== 'object') return;
        if(seen.has(node)) return;
        seen.add(node);
        const parentEventId = String((parent && (parent.id || parent.eventId)) || (node && (node.eventId || node.id)) || '');
        const arrays = [];
        if(Array.isArray(node.scoringPlays)) arrays.push(node.scoringPlays);
        if(Array.isArray(node.scoringplays)) arrays.push(node.scoringplays);
        arrays.forEach(list => {
          list.forEach(play => {
            if(!play || typeof play !== 'object') return;
            const text = String(play.text || play.description || play.displayText || '');
            const typeText = String((play.type && (play.type.text || play.type.description || play.type.name)) || play.scoringType || '');
            const lower = (text + ' ' + typeText).toLowerCase();
            if(lower && !/(goal|penalty|own goal|gol)/i.test(lower)) return;
            const player = extractScoringPlayerName(play);
            if(!player) return;
            const team = readDisplayName(play.team || play.competitor || play.club) || '';
            const minute = String(play.clock || play.displayClock || play.time || play.period && play.period.displayValue || play.sequenceNumber || '');
            const matchKey = parentEventId || String(play.competitionId || play.id || '');
            events.push({
              player,
              team,
              kind: 'goal',
              minute,
              eventId: parentEventId || String(play.eventId || play.id || ''),
              matchKey,
              updatedAt: new Date().toISOString()
            });
          });
        });
        if(Array.isArray(node)){
          node.forEach(x => walk(x, parent));
          return;
        }
        Object.keys(node).forEach(k => {
          const v = node[k];
          if(v && typeof v === 'object') walk(v, node);
        });
      }
      walk(data, {});
      return events;
    }
    function rebuildScoreIndex(){
      const byEvent = {};
      const byPair = {};
      Object.values(app.scores || {}).forEach(s => {
        if(!s) return;
        const eventId = String(s.eventId || '');
        if(eventId) byEvent[eventId] = s;
        const pair = [normalizeTeam(s.home), normalizeTeam(s.away)].sort().join('|');
        if(pair && pair !== '|') byPair[pair] = s;
      });
      app.scoreIndex = {eventId: byEvent, pair: byPair};
      app.scoreIndexDirty = false;
    }
    function ensureScoreIndex(){
      if(app.scoreIndexDirty) rebuildScoreIndex();
      return app.scoreIndex || {eventId:{}, pair:{}};
    }
    function updateScoreInfoStrip(){
      $('#infoStrip').text(scoreUpdatedText());
    }
    function matchPairKey(teamA, teamB){
      return [normalizeTeam(teamA), normalizeTeam(teamB)].join('|');
    }
    function sortedMatchPairKey(teamA, teamB){
      return [normalizeTeam(teamA), normalizeTeam(teamB)].sort().join('|');
    }
    function staticEspnEventIdForPair(teamA, teamB){
      return ESPN_EVENT_ID_BY_MATCH[matchPairKey(teamA, teamB)]
        || ESPN_EVENT_ID_BY_MATCH[matchPairKey(teamB, teamA)]
        || ESPN_EVENT_ID_BY_MATCH[sortedMatchPairKey(teamA, teamB)]
        || '';
    }
    function espnEventIdForMatch(m){
      if(!m) return '';
      if(m._eventId) return m._eventId;
      const staticId = staticEspnEventIdForPair(m.team1, m.team2);
      if(staticId) return staticId;

      // 如果 scoreboard/header 曾经拿到过 eventId，也用它作为 summary 兜底。
      const s = getScoreForMatch(m);
      return s && s.eventId ? s.eventId : '';
    }
    function parseEspnSummary(data){
      const header = data.header || {};
      const comp = (header.competitions || [])[0];
      const teams = (comp && comp.competitors) || [];
      if(teams.length < 2) return {};
      const home = teams.find(x => x.homeAway === 'home') || teams[0];
      const away = teams.find(x => x.homeAway === 'away') || teams[1];
      const statusRoot = comp.status || header.status || {};
      const status = statusRoot.type || {};
      const eventDate = new Date(comp.date || header.competitionDate || header.season && header.season.startDate || Date.now());
      const homeName = home.team && (home.team.displayName || home.team.name || home.team.shortDisplayName);
      const awayName = away.team && (away.team.displayName || away.team.name || away.team.shortDisplayName);
      const item = {
        home: normalizeTeam(homeName),
        away: normalizeTeam(awayName),
        homeName,
        awayName,
        homeScore: home.score ?? '',
        awayScore: away.score ?? '',
        state: status.state || '',
        completed: !!status.completed,
        detail: status.shortDetail || status.detail || status.description || statusRoot.displayClock || '',
        clock: statusRoot.displayClock || status.shortDetail || '',
        eventDate: isNaN(eventDate.getTime()) ? '' : eventDate.toISOString(),
        updatedAt: new Date().toISOString(),
        eventId: header.id || (comp && comp.id) || ''
      };
      const out = {};
      scoreKeyVariants(eventDate, homeName, awayName).forEach(key => {
        out[key] = item;
      });
      // 额外按今天日期也写一份，避免 eventDate 解析异常。
      scoreKeyVariants(new Date(), homeName, awayName).forEach(key => {
        out[key] = item;
      });
      return out;
    }

    function competitorTeamName(c){
      return c && c.team && (c.team.displayName || c.team.name || c.team.shortDisplayName || c.team.abbreviation)
        || c && (c.displayName || c.name || c.shortDisplayName || c.abbreviation)
        || '';
    }
    function extractEspnCompetitionScore(comp, parent){
      const teams = (comp && comp.competitors) || [];
      if(teams.length < 2) return {};
      const home = teams.find(x => x.homeAway === 'home') || teams[0];
      const away = teams.find(x => x.homeAway === 'away') || teams[1];
      const statusRoot = (comp && comp.status) || (parent && parent.status) || {};
      const status = statusRoot.type || {};
      const eventDate = new Date((comp && comp.date) || (parent && (parent.date || parent.competitionDate)) || Date.now());
      const homeName = competitorTeamName(home);
      const awayName = competitorTeamName(away);
      if(!homeName || !awayName) return {};

      const item = {
        home: normalizeTeam(homeName),
        away: normalizeTeam(awayName),
        homeName,
        awayName,
        homeScore: home.score ?? home.curatedScore ?? '',
        awayScore: away.score ?? away.curatedScore ?? '',
        state: status.state || statusRoot.state || '',
        completed: !!status.completed || !!statusRoot.completed,
        detail: status.shortDetail || status.detail || status.description || statusRoot.shortDetail || statusRoot.detail || statusRoot.displayClock || '',
        clock: statusRoot.displayClock || status.shortDetail || '',
        eventDate: isNaN(eventDate.getTime()) ? '' : eventDate.toISOString(),
        updatedAt: new Date().toISOString(),
        eventId: (comp && comp.id) || (parent && parent.id) || ''
      };

      const out = {};
      scoreKeyVariants(eventDate, homeName, awayName).forEach(key => { out[key] = item; });
      scoreKeyVariants(new Date(), homeName, awayName).forEach(key => { out[key] = item; });
      return out;
    }
    function parseEspnDeepScores(data){
      const out = {};
      const seen = new Set();

      function walk(node, parent){
        if(!node || typeof node !== 'object') return;
        if(seen.has(node)) return;
        seen.add(node);

        if(Array.isArray(node.competitions)){
          node.competitions.forEach(comp => {
            Object.assign(out, extractEspnCompetitionScore(comp, node));
            walk(comp, node);
          });
        }

        if(Array.isArray(node.competitors)){
          Object.assign(out, extractEspnCompetitionScore(node, parent || {}));
        }

        if(Array.isArray(node)){
          node.forEach(x => walk(x, parent));
          return;
        }

        Object.keys(node).forEach(k => {
          const v = node[k];
          if(v && typeof v === 'object') walk(v, node);
        });
      }

      walk(data, {});
      return out;
    }

    function parseEspnEvents(data){
      const out = {};
      (data.events || []).forEach(ev => {
        const comp = (ev.competitions || [])[0];
        const teams = (comp && comp.competitors) || [];
        if(teams.length < 2) return;
        const home = teams.find(x => x.homeAway === 'home') || teams[0];
        const away = teams.find(x => x.homeAway === 'away') || teams[1];
        const status = (comp.status || ev.status || {}).type || {};
        const statusRoot = comp.status || ev.status || {};
        const eventDate = new Date(comp.date || ev.date);
        const homeName = home.team && (home.team.displayName || home.team.name || home.team.shortDisplayName);
        const awayName = away.team && (away.team.displayName || away.team.name || away.team.shortDisplayName);
        const item = {
          home: normalizeTeam(homeName),
          away: normalizeTeam(awayName),
          homeName,
          awayName,
          homeScore: home.score ?? '',
          awayScore: away.score ?? '',
          state: status.state || '',
          completed: !!status.completed,
          detail: status.shortDetail || status.detail || status.description || '',
          clock: statusRoot.displayClock || status.shortDetail || '',
          eventDate: isNaN(eventDate.getTime()) ? '' : eventDate.toISOString(),
          updatedAt: new Date().toISOString(),
          eventId: ev.id || ''
        };
        scoreKeyVariants(eventDate, homeName, awayName).forEach(key => {
          out[key] = item;
        });
      });
      return out;
    }
    function fetchScoresForDates(dateKeys, silent=false){
      const keys = [...new Set(dateKeys || [])].filter(Boolean);
      if(!keys.length) return $.Deferred().resolve().promise();
      if(app.scoreFetching) return $.Deferred().resolve().promise();
      app.scoreFetching = true;

      let successCount = 0;
      const reqs = keys.map(key => fetchScoreJson(ESPN_SCOREBOARD, {
        dates: yyyymmddFromKey(key),
        limit: 100,
        _: Date.now()
      }, silent).then(data => {
        if(mergeScoreMaps(parseEspnEvents(data), parseEspnDeepScores(data))) successCount++;
        if(mergePlayerEvents(extractPlayerEventsFromEspn(data))) successCount++;
        app.scoreSource = app.scoreSource || 'remote';
        return {ok:true, key};
      }, err => {
        if(!silent) console.warn('score fetch failed', key, err);
        return {ok:false, key};
      }));

      return $.when.apply($, reqs)
        .done(()=>{ if(successCount > 0) saveScoreCache(); })
        .always(()=>{ app.scoreFetching = false; });
    }
    function canRefreshInForeground(){
      if(document.hidden) return false;
      if(navigator.onLine === false) return false;
      return !!app.activeTab;
    }
    function visibleLiveCandidateMatches(){
      const now = new Date();

      // 不能只看 filteredMatches()。当前日期筛选可能是 06.13，
      // 但 ESPN 归档/开球时间可能属于 06.14，导致直播比赛没有进入 summary 兜底。
      return matchItems().filter(m => {
        const d = matchDate(m);
        const diff = Math.abs(d.getTime() - now.getTime());
        const score = getScoreForMatch(m);
        const st = scoreStatusOf(d, score);
        const mapped = !!espnEventIdForMatch(m);
        return st === 'live' || diff <= 8 * 60 * 60 * 1000 || (mapped && diff <= 30 * 60 * 60 * 1000);
      });
    }
    function fetchSummaryScoresForVisibleMatches(silent=false){
      const matches = visibleLiveCandidateMatches();
      const ids = [...new Set(matches.map(m => espnEventIdForMatch(m)).filter(Boolean))];
      if(!ids.length) return $.Deferred().resolve().promise();

      const reqs = ids.map(id => fetchScoreJson(ESPN_SUMMARY, {
        event: id,
        _: Date.now()
      }, silent).then(data => {
        mergeScoreMaps(parseEspnSummary(data), parseEspnDeepScores(data));
        mergePlayerEvents(extractPlayerEventsFromEspn(data));
        app.scoreSource = app.scoreSource || 'summary';
        return {ok:true, id};
      }, err => {
        if(!silent) console.warn('summary score fetch failed', id, err);
        return {ok:false, id};
      }));

      return $.when.apply($, reqs).always(saveScoreCache);
    }
    function fetchHeaderScores(silent=false){
      return fetchScoreJson(ESPN_HEADER_SCOREBOARD, {
        sport: 'soccer',
        league: 'fifa.world',
        _: Date.now()
      }, silent).then(data => {
        mergeScoreMaps(parseEspnDeepScores(data));
        mergePlayerEvents(extractPlayerEventsFromEspn(data));
        app.scoreSource = app.scoreSource || 'header';
        saveScoreCache();
        return {ok:true};
      }, err => {
        if(!silent) console.warn('header score fetch failed', err);
        return {ok:false};
      });
    }

    function refreshScoresOnce(){
      if(!canRefreshInForeground()) return $.Deferred().resolve().promise();
      if(app.scoreRefreshRunning) return $.Deferred().resolve().promise();
      app.scoreRefreshRunning = true;
      app.scoreCycleChanged = false;

      // 顺序：日期 scoreboard -> header scoreboard -> event summary。
      // 只有比分内容变化时才重绘列表，避免定时器每次都整页重建。
      return fetchScoresForDates(uniqueVisibleDateKeys(), true)
        .then(() => fetchHeaderScores(true), () => fetchHeaderScores(true))
        .then(() => fetchSummaryScoresForVisibleMatches(true), () => fetchSummaryScoresForVisibleMatches(true))
        .always(() => {
          app.scoreRefreshRunning = false;
          if(app.scoreCycleChanged) render();
          else updateScoreInfoStrip();
        });
    }
    function startLiveScoreTimer(){
      if(app.scoreTimer) clearInterval(app.scoreTimer);
      setTimeout(refreshScoresOnce, 800);
      app.scoreTimer = setInterval(() => {
        refreshScoresOnce();
      }, SCORE_REFRESH_MS);
    }
    function setupForegroundRefresh(){
      function refreshOnReturn(){
        if(document.hidden) return;
        const now = Date.now();
        if(now - (app.lastForegroundRefreshAt || 0) < 60000){
          refreshScoresOnce();
          return;
        }
        app.lastForegroundRefreshAt = now;
        loadData(true, true, true);
      }
      document.addEventListener('visibilitychange', function(){
        if(!document.hidden) refreshOnReturn();
      });
      window.addEventListener('focus', refreshOnReturn);
    }
    function getScoreForMatch(m){
      if(!m) return null;
      const keys = m._scoreKeys || scoreKeyVariants(m._date, m.team1, m.team2);
      for(const key of keys){
        if(app.scores[key]) return app.scores[key];
      }

      const index = ensureScoreIndex();
      const eventId = m._eventId || staticEspnEventIdForPair(m.team1, m.team2);
      if(eventId && index.eventId[String(eventId)]) return index.eventId[String(eventId)];

      // 最后兜底：同一届比赛同一对球队只会碰一次，队名匹配即可避免 Turkey/Türkiye 或日期归档误差。
      return index.pair[m._pairKey || sortedMatchPairKey(m.team1, m.team2)] || null;
    }
    function scoreForTeam(score, team){
      if(!score) return '';
      const n = normalizeTeam(team);
      const home = normalizeTeam(score.home);
      const away = normalizeTeam(score.away);
      if(n === home) return score.homeScore;
      if(n === away) return score.awayScore;
      return '';
    }
    function scoreStatusOf(matchDate, score){
      if(score){
        if(score.state === 'in') return 'live';
        if(score.completed || score.state === 'post') return 'finished';
        if(score.state === 'pre') return 'upcoming';
      }
      return statusOf(matchDate);
    }
    function scoreDetailText(score, fallbackStatus){
      if(score && score.detail){
        const detail = String(score.detail || '').trim();
        if(app.lang === 'en') return detail;
        const lower = detail.toLowerCase();
        if(app.lang === 'zh'){
          if(lower === 'final' || lower.includes('full')) return t('finished');
          if(lower.includes('half')) return '中场';
          if(lower.includes('scheduled') || lower.includes('pre')) return t('upcoming');
          if(lower.includes('postponed')) return '延期';
          if(lower.includes('cancelled') || lower.includes('canceled')) return '取消';
        }
        if(app.lang === 'tr'){
          if(lower === 'final' || lower.includes('full')) return t('finished');
          if(lower.includes('half')) return 'Devre arası';
          if(lower.includes('scheduled') || lower.includes('pre')) return t('upcoming');
          if(lower.includes('postponed')) return 'Ertelendi';
          if(lower.includes('cancelled') || lower.includes('canceled')) return 'İptal';
        }
        if(/[a-z]/i.test(detail)) return fallbackStatus === 'live' ? t('live') : (fallbackStatus === 'finished' ? t('finished') : t('upcoming'));
        return detail;
      }
      if(fallbackStatus === 'live') return t('live');
      if(fallbackStatus === 'finished') return t('finished');
      return t('upcoming');
    }
    function scoreUpdatedText(){
      if(!app.scoreCount) return t('scoreNone');
      const latest = app.latestScoreUpdatedAt;
      if(!latest) return app.scoreSource === 'cache' ? t('scoreCache') : t('scoreUpdating');
      const d = new Date(latest);
      return `${app.scoreSource === 'cache' ? t('scoreCache') : t('scoreUpdated')}: ${fmtDateTime(d, TZ_MAIN)}`;
    }
    function stageKey(round){
      if(/^Matchday/.test(round)) return 'group';
      if(round === 'Round of 32') return 'r32';
      if(round === 'Round of 16') return 'r16';
      if(round === 'Quarter-final') return 'qf';
      if(round === 'Semi-final') return 'sf';
      if(round === 'Match for third place') return 'bronze';
      if(round === 'Final') return 'final';
      return 'group';
    }
    function stageLabel(round){
      return memoText('stage', round, function(){
        const key = stageKey(round);
        return t(key === 'group' ? 'groupStage' : key);
      });
    }
    function parseKickoff(match){
      const raw = String(match.time || '').trim();
      const m = raw.match(/^(\d{1,2}):(\d{2})\s+UTC([+-]\d{1,2})$/i);
      if(!m) return new Date(match.date + 'T00:00:00Z');
      const hh = m[1].padStart(2,'0'), mm = m[2], off = Number(m[3]);
      const sign = off >= 0 ? '+' : '-';
      const abs = String(Math.abs(off)).padStart(2,'0');
      return new Date(`${match.date}T${hh}:${mm}:00${sign}${abs}:00`);
    }
    const formatterCache = Object.create(null);
    function formatter(locale, timeZone, options){
      const key = locale + '|' + timeZone + '|' + Object.keys(options).sort().map(k => k + ':' + options[k]).join(',');
      if(!formatterCache[key]) formatterCache[key] = new Intl.DateTimeFormat(locale, Object.assign({timeZone}, options));
      return formatterCache[key];
    }
    function partsObject(date, fmt){
      const out = {};
      fmt.formatToParts(date).forEach(x => { out[x.type] = x.value; });
      return out;
    }
    function dateKey(date, timeZone){
      const o = partsObject(date, formatter('en-CA', timeZone, {year:'numeric', month:'2-digit', day:'2-digit'}));
      return `${o.year}-${o.month}-${o.day}`;
    }
    function matchDateKey(match, timeZone){
      if(timeZone === TZ_MAIN && match && match._dateKeyMain) return match._dateKeyMain;
      if(timeZone === TZ_CHINA && match && match._dateKeyChina) return match._dateKeyChina;
      return dateKey(matchDate(match), timeZone);
    }
    function weekdayText(date, timeZone){
      return formatter(localeForLang(), timeZone, {weekday:'short'}).format(date);
    }
    function dayShort(date, timeZone){
      const o = partsObject(date, formatter('en-US', timeZone, {month:'2-digit', day:'2-digit'}));
      return `${o.month}.${o.day}`;
    }
    function fullDayTitle(date){
      return formatter(localeForLang(), primaryTimeZone(), {month:'long', day:'numeric', weekday:'long'}).format(date);
    }
    function fmtTime(date, timeZone){
      return formatter(localeForLang(), timeZone, {hour:'2-digit', minute:'2-digit', hour12:false}).format(date).replace('24:','00:');
    }
    function fmtDateTime(date, timeZone){
      return formatter(localeForLang(), timeZone, {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false}).format(date).replace('24:','00:');
    }
    function todayDateKey(){
      return dateKey(new Date(), primaryTimeZone());
    }
    function applyTodayDefaultDate(){
      app.todayOnly = false;
      app.activeDate = todayDateKey();
      $('#todayBtn').removeClass('active');
    }
    function ensureInitialTodayDate(){
      if(app.activeDate === '__today__' || !app.activeDate){
        applyTodayDefaultDate();
      }
    }
    function matchesSignature(matches){
      return (matches || []).map(m => [
        m.num || '', m.date || '', m.time || '', m.round || '', m.group || '',
        m.team1 || '', m.team2 || '', m.ground || ''
      ].join('~')).join('\n');
    }
    function applyLoadedMatches(matches, source, forceRender=false){
      const next = Array.isArray(matches) ? matches : [];
      const sig = matchesSignature(next);
      const changed = sig !== app.matchesSignature;
      app.matches = next;
      app.matchItems = next.map(createMatchItem);
      app.matchesSignature = sig;
      app.source = source;
      ensureInitialTodayDate();

      if(changed){
        app.lastContentHtml = '';
        app.lastLivePanelHtml = '';
        app.lastDateBarHtml = '';
        app.lastOtherHtml = '';
        app.textCache = Object.create(null);
      }

      if(changed || !app.controlsReady){
        preloadAllFlags(app.matchItems);
        buildTeamOptions();
        buildDateBar(app.matchItems);
        app.controlsReady = true;
      }

      if(changed || forceRender || !app.hasRenderedSchedule){
        render();
        app.hasRenderedSchedule = true;
      }
      return changed;
    }

    function statusOf(date){
      const now = new Date();
      const end = new Date(date.getTime() + 2*60*60*1000);
      if(now >= date && now <= end) return 'live';
      if(now > end) return 'finished';
      return 'upcoming';
    }
    function flagUrl(team){
      const code = TEAM_CODE[team];
      if(!code) return '';
      return `https://flagcdn.com/w80/${code}.png`;
    }
    function absoluteAssetUrl(url){
      try{return new URL(url, location.href).href;}catch(e){return String(url || '');}
    }
    function ensureFlagPreloadPool(){
      let pool = document.getElementById('flagPreloadPool');
      if(!pool){
        pool = document.createElement('div');
        pool.id = 'flagPreloadPool';
        pool.className = 'flag-preload-pool';
        document.body.appendChild(pool);
      }
      return pool;
    }
    function syncFlagPreloadPool(urls){
      const pool = ensureFlagPreloadPool();
      const existing = new Set(Array.from(pool.querySelectorAll('img')).map(img => img.src));
      urls.forEach(url=>{
        const abs = absoluteAssetUrl(url);
        if(!abs || existing.has(abs)) return;
        const img = document.createElement('img');
        img.src = abs;
        img.loading = 'eager';
        img.decoding = 'async';
        img.draggable = false;
        img.onload = function(){ app.loadedFlags.add(abs); };
        img.onerror = function(){ app.loadedFlags.add(abs); };
        pool.appendChild(img);
        existing.add(abs);
        if(img.decode){
          try{ img.decode().then(()=>app.loadedFlags.add(abs)).catch(()=>{}); }catch(e){}
        }
      });
    }
    function runIdleTask(fn, delay=0){
      if('requestIdleCallback' in window){
        return window.requestIdleCallback(fn, {timeout: delay + 1000});
      }
      return window.setTimeout(fn, delay);
    }
    function preloadAllFlags(matches){
      const urls = [];
      const seen = new Set();
      (matches || []).forEach(m=>{
        [flagUrl(m.team1), flagUrl(m.team2)].forEach(url => {
          if(url && !seen.has(url)){
            seen.add(url);
            urls.push(url);
          }
        });
      });
      app.flagPreloadJob += 1;
      const job = app.flagPreloadJob;
      let cursor = 0;
      function pump(){
        if(job !== app.flagPreloadJob || cursor >= urls.length) return;
        syncFlagPreloadPool(new Set(urls.slice(cursor, cursor + 10)));
        cursor += 10;
        if(cursor < urls.length) runIdleTask(pump, 180);
      }
      runIdleTask(pump, 250);
    }

    function cssUrlValue(url){
      return String(url || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }
    function flagImgHtml(team){
      const src = flagUrl(team);
      const name = teamName(team);
      if(!src) return placeholderFlag(team);
      const abs = absoluteAssetUrl(src);
      return `<span class="flag-bg" role="img" aria-label="${esc(name)}" style="background-image:url(&quot;${esc(cssUrlValue(abs))}&quot;)"></span>`;
    }

    function placeholderFlag(team){
      const label = app.lang === 'en' ? String(team || '').slice(0,3).toUpperCase() : teamName(team).slice(0, app.lang === 'zh' ? 2 : 3);
      return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;color:#8390a4;background:linear-gradient(180deg,#fff,#f3f5f9)">${esc(label)}</div>`;
    }
    function noteText(m){
      const cacheKey = m && m._idx != null ? m._idx : `${m && m.round}|${m && m.group}|${m && m.ground}`;
      return memoText('note', cacheKey, function(){
        const stage = stageLabel(m.round);
        const group = m.group ? groupLabel(m.group) : stage;
        const venue = groundName(m.ground);
        const country = groundCountryName(m.ground);
        return country ? `${stage} · ${group} · ${venue} · ${country}` : `${stage} · ${group} · ${venue}`;
      });
    }

    function buildStageOptions(){
      const current = $('#stageSelect').val() || 'all';
      $('#stageSelect').html(`
        <option value="all">${esc(t('stageAll'))}</option>
        <option value="group">${esc(t('groupStage'))}</option>
        <option value="r32">${esc(t('r32'))}</option>
        <option value="r16">${esc(t('r16'))}</option>
        <option value="qf">${esc(t('qf'))}</option>
        <option value="sf">${esc(t('sf'))}</option>
        <option value="bronze">${esc(t('bronze'))}</option>
        <option value="final">${esc(t('final'))}</option>
      `);
      $('#stageSelect').val(current);
    }
    function buildTeamOptions(){
      const current = $('#teamSelect').val() || 'all';
      const teams = [...new Set(app.matches.flatMap(m=>[m.team1,m.team2]).filter(Boolean).filter(x=>!/^[WL]?\d|^3[A-L/]+$/.test(x)))].sort((a,b)=>teamName(a).localeCompare(teamName(b), app.lang === 'zh' ? 'zh' : 'en'));
      $('#teamSelect').html(`<option value="all">${esc(t('teamAll'))}</option>` + teams.map(x=>`<option value="${esc(x)}">${esc(teamName(x))}</option>`).join(''));
      $('#teamSelect').val(teams.includes(current) ? current : 'all');
    }
    function scorePairTextForMatch(match, score){
      if(!score) return null;
      let s1 = scoreForTeam(score, match.team1);
      let s2 = scoreForTeam(score, match.team2);
      if((s1 === '' || s2 === '') && score.homeScore !== '' && score.awayScore !== ''){
        const t1 = normalizeTeam(match.team1);
        const t2 = normalizeTeam(match.team2);
        if(t1 === score.home && t2 === score.away){ s1 = score.homeScore; s2 = score.awayScore; }
        else if(t1 === score.away && t2 === score.home){ s1 = score.awayScore; s2 = score.homeScore; }
      }
      if(s1 === '' || s2 === '' || s1 == null || s2 == null) return null;
      return `${s1}-${s2}`;
    }
    function tinyFlagHtml(team){
      const src = flagUrl(team);
      const name = teamName(team);
      if(!src) return '<span class="live-mini-flag live-mini-flag--fallback" aria-hidden="true"></span>';
      const abs = absoluteAssetUrl(src);
      return `<span class="live-mini-flag" role="img" aria-label="${esc(name)}" style="background-image:url(&quot;${esc(cssUrlValue(abs))}&quot;)"></span>`;
    }
    function liveMatchItems(){
      return matchItems().map(match=>{
        const score = getScoreForMatch(match);
        const st = scoreStatusOf(match._date, score);
        return {match, score, st, idx: match._idx};
      }).filter(x=>x.st === 'live');
    }
    function renderLivePanel(){
      const panel = $('#livePanel');
      if(!panel.length) return;
      if(app.activeTab !== 'schedule' || ($('#predictionPage').length && !$('#predictionPage').hasClass('hidden'))){
        panel.addClass('hidden').removeClass('is-collapsed').empty();
        app.lastLivePanelHtml = '';
        return;
      }
      const live = liveMatchItems();
      if(!live.length){
        panel.addClass('hidden').removeClass('is-collapsed').empty();
        app.lastLivePanelHtml = '';
        return;
      }
      const countText = app.lang === 'zh' ? `${live.length}${t('liveCount')}` : `${live.length} ${t('liveCount')}`;
      const cards = live.map(item=>{
        const m = item.match;
        const scoreText = scorePairTextForMatch(m, item.score) || '0-0';
        const minute = scoreDetailText(item.score, item.st) || t('live');
        return `<button class="live-match-card" type="button" data-match-idx="${esc(item.idx)}">
          <div class="live-match-top">
            <span>${esc(stageLabel(m.round))}${m.group ? ' · ' + esc(groupLabel(m.group)) : ''}</span>
            <span class="live-match-minute">${esc(minute)}</span>
          </div>
          <div class="live-match-score">
            <span class="live-team-side">${tinyFlagHtml(m.team1)}<span class="live-match-team">${esc(teamName(m.team1))}</span></span>
            <span class="live-match-mid">${esc(scoreText)}</span>
            <span class="live-team-side away"><span class="live-match-team away">${esc(teamName(m.team2))}</span>${tinyFlagHtml(m.team2)}</span>
          </div>
          <div class="live-match-sub">${esc(groundName(m.ground))}${groundCountryName(m.ground) ? ' · ' + esc(groundCountryName(m.ground)) : ''}</div>
        </button>`;
      }).join('');
      const panelHtml = `<div class="live-panel-head" role="button" tabindex="0" aria-expanded="${app.liveCollapsed ? 'false' : 'true'}">
          <div class="live-panel-title"><span class="live-pulse"></span><span>${esc(t('liveNow'))}</span></div>
          <div class="live-panel-actions">
            <div class="live-panel-count">${esc(countText)}</div>
            <button class="live-collapse-btn ${app.liveCollapsed ? 'is-collapsed' : ''}" type="button" aria-label="${app.liveCollapsed ? '展开正在比赛' : '折叠正在比赛'}">⌄</button>
          </div>
        </div><div class="live-panel-list">${cards}</div>`;
      panel.toggleClass('is-collapsed', !!app.liveCollapsed);
      setHtmlIfChanged(panel, panelHtml, 'lastLivePanelHtml');
      panel.removeClass('hidden');
    }

    function scrollDateBarToActiveDate(){
      const bar = document.getElementById('dateBar');
      if(!bar) return;
      requestAnimationFrame(()=>{
        const active = bar.querySelector('.date-chip.active');
        if(!active) return;
        if(active.dataset.date === 'all'){
          bar.scrollTo({left:0, behavior:'auto'});
          return;
        }
        const targetLeft = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
        const maxLeft = Math.max(0, bar.scrollWidth - bar.clientWidth);
        const left = Math.max(0, Math.min(maxLeft, targetLeft));
        bar.scrollTo({left, behavior:'auto'});
      });
    }

    // 日期筛选跟随主时区：设备在中国则按北京时间分组/显示，设备在墨西哥则按蒙特雷时间。
    function buildDateBar(arr){
      const displayTz = primaryTimeZone();
      const now = new Date();
      const nowKey = dateKey(now, displayTz);
      const tomorrowKey = dateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000), displayTz);
      const map = new Map();
      (arr || []).forEach(m=>{
        const d = matchDate(m);
        const key = matchDateKey(m, displayTz);
        if(!map.has(key)) map.set(key, d);
      });
      const dates = [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
      let html = `<button class="date-chip ${app.activeDate==='all'?'active':''}" data-date="all"><div class="d1">${esc(t('allDates'))}</div><div class="d2">${esc(t('allDatesShort'))}</div></button>`;
      dates.forEach(([key,date])=>{
        let subtitle = weekdayText(date, displayTz);
        if(key === nowKey) subtitle = t('today');
        else if(key === tomorrowKey) subtitle = t('tomorrow');
        html += `<button class="date-chip ${app.activeDate===key?'active':''}" data-date="${esc(key)}"><div class="d1">${esc(dayShort(date, displayTz))}</div><div class="d2">${esc(subtitle)}</div></button>`;
      });
      if(app.lastDateBarHtml !== html){
        $('#dateBar').html(html);
        app.lastDateBarHtml = html;
        scrollDateBarToActiveDate();
      }
    }

    function applyLang(){
      document.documentElement.lang = t('htmlLang');
      document.title = t('browserTitle') || `${t('title')} ${APP_VERSION}`;
      setPwaAppNameByDevice();
      $('#pageTitle').html(`<span class="title-text">${esc(t('title'))}</span><span class="version-badge">${esc(APP_VERSION)}</span>`);
      $('#langMenuBtn').text(selectedLangLabel());
      $('#langZh').text(t('langZhLabel'));
      $('#langEn').text(t('langEnLabel'));
      $('#langTr').text(t('langTrLabel'));
      $('#tabSchedule').text(t('schedule'));
      $('#tabStanding').text(t('standing'));
      $('#tabPlayers').text(t('players'));
      $('#tabTeams').text(t('teams'));
      $('#tabBracket').text(t('bracket'));
      $('#resetBtn').text(t('reset'));
      $('#todayBtn').text(t('todayBtn'));
      $('#allDatesBtn').text(t('allDatesBtn'));
      $('#refreshBtn').attr({'aria-label': t('refresh'), title: t('refresh')});
      $('#mobileMoreLabel').text(t('more'));
      updateScoreInfoStrip();
      $('#loadingText').text(t('loading'));
      if(app.activeTab !== 'schedule') app.lastOtherHtml = '';
      $('#langMenuBtn').addClass('active');
      $('#langZh').toggleClass('active', app.lang==='zh');
      $('#langEn').toggleClass('active', app.lang==='en');
      $('#langTr').toggleClass('active', app.lang==='tr');
      buildStageOptions();
      buildTeamOptions();
      buildDateBar(app.matchItems);
      setupDateBarDesktopScroll();
      if(app.predictionIndex !== null && !$('#predictionPage').hasClass('hidden')) renderPredictionPage();
    }

    function filteredMatches(){
      const stage = $('#stageSelect').val() || 'all';
      const team = $('#teamSelect').val() || 'all';
      const now = new Date();
      const displayTz = primaryTimeZone();
      const todayKey = app.todayOnly ? dateKey(now, displayTz) : '';
      return matchItems().filter(m=>{
        const mDateKey = matchDateKey(m, displayTz);
        if(app.activeDate !== 'all' && mDateKey !== app.activeDate) return false;
        if(app.todayOnly && mDateKey !== todayKey) return false;
        if(stage !== 'all' && (m._stageKey || stageKey(m.round)) !== stage) return false;
        if(team !== 'all' && m.team1 !== team && m.team2 !== team) return false;
        return true;
      }).sort((a,b)=>a._date-b._date);
    }


    function realTeamName(raw){
      return !!raw && !/^[WL]\d+|^[12][A-L]$|^3[A-L/]+$/i.test(String(raw));
    }
    function groupLetter(group){
      const m = String(group || '').match(/Group\s+([A-L])/i);
      return m ? m[1].toUpperCase() : '';
    }
    function allGroupTeams(){
      const groups = {};
      matchItems().forEach(m => {
        const g = groupLetter(m.group);
        if(!g) return;
        groups[g] ||= [];
        [m.team1, m.team2].forEach(team => {
          if(realTeamName(team) && !groups[g].includes(team)) groups[g].push(team);
        });
      });
      Object.keys(groups).forEach(g => groups[g].sort((a,b)=>teamName(a).localeCompare(teamName(b), localeForLang())));
      return groups;
    }
    function numericScoreForMatch(m){
      const score = getScoreForMatch(m);
      const st = scoreStatusOf(m._date, score);
      const s1 = Number(scoreForTeam(score, m.team1));
      const s2 = Number(scoreForTeam(score, m.team2));
      if(!Number.isFinite(s1) || !Number.isFinite(s2)) return null;
      if(st !== 'finished' && st !== 'live') return null;
      return {s1, s2, st};
    }
    function buildStandings(){
      const groups = allGroupTeams();
      const table = {};
      Object.keys(groups).forEach(g => {
        table[g] = {};
        groups[g].forEach(team => {
          table[g][team] = {group:g, team, played:0, win:0, draw:0, loss:0, gf:0, ga:0, gd:0, pts:0, form:[]};
        });
      });
      matchItems().forEach(m => {
        const g = groupLetter(m.group);
        if(!g || !table[g] || !realTeamName(m.team1) || !realTeamName(m.team2)) return;
        const res = numericScoreForMatch(m);
        if(!res) return;
        const a = table[g][m.team1] || (table[g][m.team1] = {group:g, team:m.team1, played:0, win:0, draw:0, loss:0, gf:0, ga:0, gd:0, pts:0, form:[]});
        const b = table[g][m.team2] || (table[g][m.team2] = {group:g, team:m.team2, played:0, win:0, draw:0, loss:0, gf:0, ga:0, gd:0, pts:0, form:[]});
        a.played++; b.played++;
        a.gf += res.s1; a.ga += res.s2; b.gf += res.s2; b.ga += res.s1;
        if(res.s1 > res.s2){ a.win++; b.loss++; a.pts += 3; a.form.push('W'); b.form.push('L'); }
        else if(res.s1 < res.s2){ b.win++; a.loss++; b.pts += 3; b.form.push('W'); a.form.push('L'); }
        else { a.draw++; b.draw++; a.pts += 1; b.pts += 1; a.form.push('D'); b.form.push('D'); }
      });
      Object.keys(table).forEach(g => {
        Object.values(table[g]).forEach(r => { r.gd = r.gf - r.ga; r.form = r.form.slice(-5); });
        table[g] = Object.values(table[g]).sort((a,b)=>
          b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.ga - b.ga || teamPower(b.team) - teamPower(a.team) || teamName(a.team).localeCompare(teamName(b.team), localeForLang())
        );
      });
      return table;
    }
    function formHtml(form){
      if(!form || !form.length) return '<span class="form-empty">-</span>';
      return form.map(x => `<span class="form-dot ${x.toLowerCase()}">${esc(x)}</span>`).join('');
    }
    function renderStandingsView(){
      const table = buildStandings();
      const groups = Object.keys(table).sort();
      if(!groups.length) return dataEmptyHtml(t('standingsTitle'), t('noData'));
      const cards = groups.map(g => {
        const rows = table[g].map((r, idx) => `<tr>
          <td class="rank-cell">${idx + 1}</td>
          <td class="team-cell">${tinyFlagHtml(r.team)}<span>${esc(teamName(r.team))}</span></td>
          <td>${r.played}</td><td>${r.win}</td><td>${r.draw}</td><td>${r.loss}</td>
          <td>${r.gf}</td><td>${r.ga}</td><td class="gd-cell">${r.gd > 0 ? '+' : ''}${r.gd}</td>
          <td class="pts-cell">${r.pts}</td><td class="form-cell">${formHtml(r.form)}</td>
        </tr>`).join('');
        return `<section class="data-card standings-card">
          <div class="data-card-head"><div><h3>${esc(groupLabel('Group ' + g))}</h3><p>${esc(t('standingsHint'))}</p></div></div>
          <div class="data-table-wrap"><table class="data-table standings-table">
            <thead><tr><th>#</th><th>${esc(t('teamHeader'))}</th><th>${esc(t('playedShort'))}</th><th>${esc(t('winShort'))}</th><th>${esc(t('drawShort'))}</th><th>${esc(t('lossShort'))}</th><th>${esc(t('gfShort'))}</th><th>${esc(t('gaShort'))}</th><th>${esc(t('gdShort'))}</th><th>${esc(t('ptsShort'))}</th><th>${esc(t('formShort'))}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </section>`;
      }).join('');
      return dataShell(t('standingsTitle'), t('standingsHint'), cards);
    }
    function buildTeamRanking(){
      const table = buildStandings();
      const rows = [];
      Object.values(table).forEach(list => list.forEach(r => {
        const power = teamPower(r.team);
        const rating = Math.round(r.pts * 20 + r.gd * 4 + r.gf * 2 + power);
        rows.push({...r, power, rating});
      }));
      rows.sort((a,b)=> b.rating - a.rating || b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.power - a.power || teamName(a.team).localeCompare(teamName(b.team), localeForLang()));
      return rows;
    }
    function renderTeamBoardView(){
      const rows = buildTeamRanking();
      if(!rows.length) return dataEmptyHtml(t('teamBoardTitle'), t('noData'));
      const top = rows.slice(0, 12).map((r, idx) => `<article class="team-rank-card ${idx < 3 ? 'top' : ''}">
        <div class="team-rank-no">${idx + 1}</div>
        <div class="team-rank-main">${tinyFlagHtml(r.team)}<div><div class="team-rank-name">${esc(teamName(r.team))}</div><div class="team-rank-sub">${esc(groupLabel('Group ' + r.group))} · ${esc(fifaWorldRankText(r.team))}</div></div></div>
        <div class="team-rank-score"><strong>${r.rating}</strong><span>${esc(t('ratingHeader'))}</span></div>
      </article>`).join('');
      const tableRows = rows.map((r, idx) => `<tr>
        <td class="rank-cell">${idx + 1}</td><td class="team-cell">${tinyFlagHtml(r.team)}<span>${esc(teamName(r.team))}</span></td>
        <td>${esc(groupLabel('Group ' + r.group))}</td><td class="pts-cell">${r.pts}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td>${r.gf}</td><td>${r.power}</td><td class="pts-cell">${r.rating}</td>
      </tr>`).join('');
      return dataShell(t('teamBoardTitle'), t('teamBoardHint'), `<div class="team-rank-grid">${top}</div><section class="data-card"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>#</th><th>${esc(t('teamHeader'))}</th><th>${esc(t('allGroups'))}</th><th>${esc(t('ptsShort'))}</th><th>${esc(t('gdShort'))}</th><th>${esc(t('gfShort'))}</th><th>${esc(t('powerHeader'))}</th><th>${esc(t('ratingHeader'))}</th></tr></thead><tbody>${tableRows}</tbody></table></div></section>`);
    }
    function renderPlayerBoardView(){
      const rows = Object.values(app.playerStats || {}).sort((a,b)=> b.goals - a.goals || b.assists - a.assists || b.matches - a.matches || String(a.player).localeCompare(String(b.player), localeForLang()));
      if(!rows.length){
        return dataShell(t('playerBoardTitle'), t('playerBoardHint'), `<section class="data-card empty-data-card"><div class="empty-icon">⚽</div><h3>${esc(t('playerDataWaiting'))}</h3><p>${esc(t('playerBoardHint'))}</p></section>`);
      }
      const tableRows = rows.slice(0, 50).map((r, idx) => `<tr>
        <td class="rank-cell">${idx + 1}</td><td class="player-cell"><strong>${esc(r.player)}</strong><span>${esc(teamName(r.team))}</span></td>
        <td class="team-cell">${tinyFlagHtml(r.team)}<span>${esc(teamName(r.team))}</span></td><td class="pts-cell">${r.goals}</td><td>${r.assists}</td><td>${r.matches}</td>
      </tr>`).join('');
      const top = rows.slice(0, 6).map((r, idx) => `<article class="player-rank-card ${idx === 0 ? 'first' : ''}"><div class="player-rank-medal">${idx + 1}</div><div class="player-rank-name">${esc(r.player)}</div><div class="player-rank-team">${tinyFlagHtml(r.team)}${esc(teamName(r.team))}</div><div class="player-rank-goals"><strong>${r.goals}</strong><span>${esc(t('goalsHeader'))}</span></div></article>`).join('');
      return dataShell(t('playerBoardTitle'), t('playerBoardHint'), `<div class="player-rank-grid">${top}</div><section class="data-card"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>#</th><th>${esc(t('playerBoardTitle'))}</th><th>${esc(t('teamHeader'))}</th><th>${esc(t('goalsHeader'))}</th><th>${esc(t('assistsHeader'))}</th><th>${esc(t('matchesHeader'))}</th></tr></thead><tbody>${tableRows}</tbody></table></div></section>`);
    }
    function sortedTeamsForGroup(letter){
      const table = buildStandings();
      return table[letter] || [];
    }
    function resolvePlaceholderTeam(raw){
      const s = String(raw || '');
      let m = s.match(/^([12])([A-L])$/i);
      if(m){
        const idx = Number(m[1]) - 1;
        const row = sortedTeamsForGroup(m[2].toUpperCase())[idx];
        return row ? row.team : teamName(s);
      }
      m = s.match(/^3([A-L/]+)$/i);
      if(m) return `${t('bestThird')} ${m[1]}`;
      m = s.match(/^W(\d+)$/i);
      if(m){
        const source = matchItems().find(x => String(x.num) === m[1]);
        const w = source && winnerOfMatch(source);
        return w || `${t('winnerOf')} ${m[1]}`;
      }
      m = s.match(/^L(\d+)$/i);
      if(m){
        const source = matchItems().find(x => String(x.num) === m[1]);
        const l = source && loserOfMatch(source);
        return l || `${t('loserOf')} ${m[1]}`;
      }
      return s || t('undecided');
    }
    function winnerOfMatch(m){
      const res = numericScoreForMatch(m);
      if(!res || res.s1 === res.s2) return '';
      return res.s1 > res.s2 ? m.team1 : m.team2;
    }
    function loserOfMatch(m){
      const res = numericScoreForMatch(m);
      if(!res || res.s1 === res.s2) return '';
      return res.s1 > res.s2 ? m.team2 : m.team1;
    }
    function bracketRoundOrder(key){
      return {r32:1,r16:2,qf:3,sf:4,final:5,bronze:6}[key] || 9;
    }
    function renderBracketView(){
      const rounds = {};
      matchItems().filter(m => (m._stageKey || stageKey(m.round)) !== 'group').forEach(m => {
        const key = m._stageKey || stageKey(m.round);
        (rounds[key] ||= []).push(m);
      });
      const keys = Object.keys(rounds).sort((a,b)=>bracketRoundOrder(a)-bracketRoundOrder(b));
      if(!keys.length) return dataEmptyHtml(t('bracketTitle'), t('noData'));
      const cols = keys.map(key => {
        const matches = rounds[key].sort((a,b)=>(Number(a.num)||0)-(Number(b.num)||0)).map(m => {
          const t1 = resolvePlaceholderTeam(m.team1);
          const t2 = resolvePlaceholderTeam(m.team2);
          const score = getScoreForMatch(m);
          const s1 = scoreForTeam(score, m.team1);
          const s2 = scoreForTeam(score, m.team2);
          const hasScore = s1 !== '' && s2 !== '';
          return `<article class="bracket-match">
            <div class="bracket-match-top"><span>#${esc(m.num || '')}</span><span>${esc(fmtDateTime(m._date, primaryTimeZone()))}</span></div>
            <div class="bracket-team">${realTeamName(t1) ? tinyFlagHtml(t1) : '<span class="live-mini-flag live-mini-flag--fallback"></span>'}<span>${esc(teamName(t1))}</span><strong>${hasScore ? esc(s1) : ''}</strong></div>
            <div class="bracket-team">${realTeamName(t2) ? tinyFlagHtml(t2) : '<span class="live-mini-flag live-mini-flag--fallback"></span>'}<span>${esc(teamName(t2))}</span><strong>${hasScore ? esc(s2) : ''}</strong></div>
            <div class="bracket-venue">${esc(groundName(m.ground))}</div>
          </article>`;
        }).join('');
        return `<section class="bracket-col"><h3>${esc(stageLabel(rounds[key][0].round))}</h3>${matches}</section>`;
      }).join('');
      return dataShell(t('bracketTitle'), t('bracketHint'), `<div class="bracket-board">${cols}</div>`);
    }
    function dataEmptyHtml(title, desc){
      return dataShell(title, desc || '', `<section class="data-card empty-data-card"><div class="empty-icon">⌕</div><h3>${esc(t('noData'))}</h3><p>${esc(t('noDataHint'))}</p></section>`);
    }
    function dataShell(title, hint, body){
      return `<div class="data-view"><section class="data-hero-card"><div><div class="data-eyebrow">${esc(t('dataCenter'))}</div><h2>${esc(title)}</h2><p>${esc(hint || '')}</p></div><div class="data-hero-badge">${esc(scoreUpdatedText())}</div></section>${body}</div>`;
    }
    function renderDataView(){
      let html = '';
      if(app.activeTab === 'standing') html = renderStandingsView();
      else if(app.activeTab === 'players') html = renderPlayerBoardView();
      else if(app.activeTab === 'teams') html = renderTeamBoardView();
      else if(app.activeTab === 'bracket') html = renderBracketView();
      else html = dataEmptyHtml(t('dataCenter'), t('unsupported'));
      setHtmlIfChanged($('#otherView'), html, 'lastOtherHtml');
    }
    function render(){
      updateScoreInfoStrip();
      $('#allDatesBtn').toggleClass('active', app.activeDate === 'all' && !app.todayOnly);
      if(app.activeTab !== 'schedule'){
        $('#scheduleView').addClass('hidden');
        $('#otherView').removeClass('hidden');
        $('#livePanel').addClass('hidden').empty();
        app.lastLivePanelHtml = '';
        renderDataView();
        return;
      }
      $('#scheduleView').removeClass('hidden');
      $('#otherView').addClass('hidden');
      renderLivePanel();
      if(app.predictionIndex !== null && !$('#predictionPage').hasClass('hidden')) renderPredictionPage();

      const list = filteredMatches();
      const content = $('#content');
      if(!app.matches.length){
        setHtmlIfChanged(content, `<div class="empty">⚽<div style="margin-top:8px">${esc(t('dataFail'))}</div></div>`, 'lastContentHtml');
        return;
      }
      if(!list.length){
        setHtmlIfChanged(content, `<div class="empty">⌕<div style="margin-top:8px">${esc(t('noData'))}</div><div style="margin-top:6px;font-size:13px">${esc(t('noDataHint'))}</div></div>`, 'lastContentHtml');
        return;
      }
      const mainTz = primaryTimeZone();
      const secondTz = secondaryTimeZone();
      const mainLabel = timeZoneLabel(mainTz);
      const secondLabel = timeZoneLabel(secondTz);
      const grouped = {};
      list.forEach(m=>{
        const key = matchDateKey(m, mainTz);
        (grouped[key] ||= []).push(m);
      });
      let html = '';
      Object.keys(grouped).sort().forEach(key=>{
        const items = grouped[key];
        html += `<section class="day-group"><h3 class="day-title">${esc(fullDayTitle(items[0]._date))}</h3><div class="cards">`;
        items.forEach(m=>{
          const score = getScoreForMatch(m);
          const st = scoreStatusOf(m._date, score);
          const isResult = st === 'finished';
          const isLive = st === 'live';
          const s1 = scoreForTeam(score, m.team1);
          const s2 = scoreForTeam(score, m.team2);
          const hasScore = st !== 'upcoming' && s1 !== '' && s2 !== '';
          const centerMain = hasScore
            ? `<div class="score">${esc(s1)} - ${esc(s2)}</div><div class="time-sub">${esc(mainLabel)}: ${esc(fmtTime(m._date, mainTz))} ｜ ${esc(secondLabel)}: ${esc(fmtDateTime(m._date, secondTz))}</div>`
            : `<div class="time-main"><span class="time-main-label">${esc(mainLabel)}:</span> ${esc(fmtTime(m._date, mainTz))}</div><div class="time-sub">${esc(secondLabel)}: ${esc(fmtDateTime(m._date, secondTz))}</div>`;
          const statusLabel = isResult ? t('finished') : scoreDetailText(score, st);
          const metaText = `${esc(stageLabel(m.round))}${m.group ? ' ' + esc(groupLabel(m.group)) : ''} ${esc(statusLabel)}`;
          const pillClass = isLive ? '' : (isResult ? 'report' : 'preview');
          const pillText = isLive ? t('liveText') : (isResult ? t('finished') : t('preview'));
          html += `<article class="match-card" data-match-idx="${esc(m._idx)}" role="button" tabindex="0">
            <div class="meta">${metaText}${isLive ? ' <span class="live">●</span>' : ''}</div>
            <div class="teams">
              <div class="team-side">
                <div class="flag-wrap">${flagImgHtml(m.team1)}</div>
                <div class="team-name">${esc(teamName(m.team1))}</div>
              </div>
              <div class="center-box">
                ${centerMain}
                <div class="state-pill ${pillClass}">${esc(pillText)}</div>
              </div>
              <div class="team-side">
                <div class="flag-wrap">${flagImgHtml(m.team2)}</div>
                <div class="team-name">${esc(teamName(m.team2))}</div>
              </div>
            </div>
            <div class="note">${esc(noteText(m))}</div>
          </article>`;
        });
        html += '</div></section>';
      });
      setHtmlIfChanged(content, html, 'lastContentHtml');
    }


    function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
    function teamPower(team){
      const raw = String(team || '');
      if(/^W\d+|L\d+|[12][A-L]|3[A-L/]+$/.test(raw)) return 72;
      return TEAM_POWER[raw] || 72;
    }
    function fifaWorldRank(team){
      const raw = String(team || '').trim();
      if(TEAM_WORLD_RANK[raw] != null) return TEAM_WORLD_RANK[raw];
      const norm = normalizeTeam(raw);
      for(const k in TEAM_WORLD_RANK){
        if(normalizeTeam(k) === norm) return TEAM_WORLD_RANK[k];
      }
      return null;
    }
    function fifaWorldRankText(team){
      const rank = fifaWorldRank(team);
      if(rank == null){
        if(app.lang === 'tr') return 'FIFA sırası yok';
        if(app.lang === 'en') return 'FIFA rank N/A';
        return 'FIFA排名暂无';
      }
      if(app.lang === 'tr') return `FIFA sırası #${rank}`;
      if(app.lang === 'en') return `FIFA rank #${rank}`;
      return `FIFA世界排名第${rank}`;
    }

    function worldCupRankForYear(team, year){
      const table = TEAM_WORLD_CUP_RANK_HISTORY[year] || {};
      const raw = String(team || '').trim();
      if(table[raw] != null) return table[raw];
      const norm = normalizeTeam(raw);
      for(const k in table){
        if(normalizeTeam(k) === norm) return table[k];
      }
      return null;
    }
    function worldCupRankHistoryInlineHtml(team){
      return `<div class="rank-history-line">${WORLD_CUP_RANK_YEARS.map(year => {
        const rank = worldCupRankForYear(team, year);
        const empty = rank == null ? ' empty' : '';
        const rankText = rank == null
          ? (app.lang === 'zh' ? '未参赛' : (app.lang === 'tr' ? 'Yok' : 'N/A'))
          : (app.lang === 'zh' ? `第${rank}名` : `#${rank}`);
        return `<span class="rank-history-chip${empty}"><span class="rank-history-year">${year}</span><span class="rank-history-rank">${esc(rankText)}</span></span>`;
      }).join('')}</div>`;
    }
    function favoredHeadline(name){
      if(app.lang === 'tr') return `${name} daha avantajlı görünüyor`;
      if(app.lang === 'en') return `${name} looks more favored`;
      return `${name} 更被看好`;
    }

    function homeBonus(match, team){
      const ground = String(match.ground || '');
      if(/Mexico City|Guadalajara|Monterrey/.test(ground) && team === 'Mexico') return 5;
      if(/Toronto|Vancouver/.test(ground) && team === 'Canada') return 4;
      if(!/Mexico City|Guadalajara|Monterrey|Toronto|Vancouver/.test(ground) && team === 'USA') return 4;
      return 0;
    }
    function poisson(k, lambda){
      let v = Math.exp(-lambda);
      for(let i=1;i<=k;i++) v *= lambda / i;
      return v;
    }
    function kickoffTempoFactor(match){
      const hour = Number(fmtTime(matchDate(match), TZ_MAIN).split(':')[0]);
      if(hour >= 11 && hour <= 14) return .94;
      if(hour >= 20 || hour <= 10) return 1.04;
      return 1;
    }
    function roundStageType(match){
      const r = String(match.round || '').toLowerCase();
      if(r.includes('final')) return 'final';
      if(r.includes('semi') || r.includes('quarter') || r.includes('round of')) return 'knockout';
      if(r.includes('group')) return 'group';
      return 'other';
    }
    function groupRoundRisk(match){
      const no = Number(match.num || match.matchday || 0);
      if(!no) return 1;
      if(no <= 24) return .94;       // 小组赛首轮通常更谨慎
      if(no <= 48) return 1.00;      // 第二轮正常
      return 1.08;                   // 第三轮可能更开放
    }
    function buildScoreDistribution(match, r1, r2, drawRate){
      const diff = r1 - r2;
      const absDiff = Math.abs(diff);
      const avg = (r1 + r2) / 2;
      const stage = roundStageType(match);
      const timeFactor = kickoffTempoFactor(match);
      const groupFactor = stage === 'group' ? groupRoundRisk(match) : 1;
      const host1 = homeBonus(match, match.team1);
      const host2 = homeBonus(match, match.team2);

      // 足球精确比分不能按“强队一定多进球”粗暴推，世界杯多数比分集中在 0-0 到 2-1。
      let totalGoals = 2.04 + (avg - 76) * 0.008 + absDiff * 0.010;
      if(stage === 'final') totalGoals *= .84;
      else if(stage === 'knockout') totalGoals *= .90;
      else totalGoals *= .96;
      totalGoals *= timeFactor * groupFactor;

      // 双方很接近时更容易低比分/平局；强弱明显才略微提高总进球。
      if(absDiff < 5) totalGoals -= .18;
      if(absDiff > 18) totalGoals += .16;
      totalGoals = clamp(totalGoals, 1.35, 2.85);

      let share1 = .5 + diff * .010 + host1 * .010 - host2 * .006;
      share1 = clamp(share1, .34, .66);

      let lambda1 = clamp(totalGoals * share1, .35, 2.25);
      let lambda2 = clamp(totalGoals * (1 - share1), .32, 2.10);

      const rows = [];
      for(let h=0; h<=5; h++){
        for(let a=0; a<=5; a++){
          let prob = poisson(h, lambda1) * poisson(a, lambda2);
          const goals = h + a;
          const margin = Math.abs(h - a);

          // 世界杯比分经验权重：1-0、1-1、2-1、0-1、2-0 权重更高。
          if(goals <= 1) prob *= 1.18;
          if(goals === 2) prob *= 1.22;
          if(goals === 3) prob *= 1.06;
          if(goals >= 4) prob *= .72;
          if(goals >= 5) prob *= .50;

          // 平局保护：接近对局更容易 0-0 / 1-1；强弱明显时减少平局权重。
          if(h === a){
            prob *= 1 + (drawRate - 22) / 42;
            if(absDiff < 6) prob *= 1.16;
            if(absDiff > 16) prob *= .82;
            if(h >= 2) prob *= .78;
          }

          // 领先一球是最常见赢球方式，过大分差下调。
          if(margin === 1) prob *= 1.14;
          if(margin === 2 && absDiff >= 12) prob *= 1.04;
          if(margin >= 3) prob *= .58;

          // 强队领先后收缩，小比分赢球更常见。
          if(diff > 8 && h > a){
            if(h === 1 && a === 0) prob *= 1.16;
            if(h === 2 && a <= 1) prob *= 1.10;
            if(h >= 3) prob *= .84;
          }
          if(diff < -8 && a > h){
            if(a === 1 && h === 0) prob *= 1.16;
            if(a === 2 && h <= 1) prob *= 1.10;
            if(a >= 3) prob *= .84;
          }

          // 弱队破门概率：强弱差不是特别大时，2-1 比 2-0 更常见；差距很大时 2-0 更合理。
          if(absDiff >= 8 && absDiff <= 18){
            if((h === 2 && a === 1 && diff > 0) || (h === 1 && a === 2 && diff < 0)) prob *= 1.12;
          }
          if(absDiff > 18){
            if((h === 2 && a === 0 && diff > 0) || (h === 0 && a === 2 && diff < 0)) prob *= 1.16;
          }

          rows.push({score:`${h}-${a}`, h, a, prob, outcome: h>a ? 'home' : (h<a ? 'away' : 'draw')});
        }
      }

      const total = rows.reduce((s,x)=>s+x.prob,0) || 1;
      rows.forEach(x=>x.prob = x.prob / total);
      rows.sort((a,b)=>b.prob-a.prob);
      return {rows, lambda1, lambda2};
    }
    function predictionModel(match){
      const r1 = teamPower(match.team1) + homeBonus(match, match.team1);
      const r2 = teamPower(match.team2) + homeBonus(match, match.team2);
      const diff = r1 - r2;
      let draw = clamp(27 - Math.abs(diff) * .22, 18, 30);
      let p1 = 36 + diff * .85 + homeBonus(match, match.team1) * 1.2;
      let p2 = 36 - diff * .85 + homeBonus(match, match.team2) * 1.2;
      const sum = p1 + p2 + draw;
      p1 = Math.round(p1 / sum * 100);
      p2 = Math.round(p2 / sum * 100);
      draw = Math.max(1, 100 - p1 - p2);

      const dist = buildScoreDistribution(match, r1, r2, draw);
      const homeProb = dist.rows.filter(x=>x.outcome==='home').reduce((s,x)=>s+x.prob,0);
      const drawProb = dist.rows.filter(x=>x.outcome==='draw').reduce((s,x)=>s+x.prob,0);
      const awayProb = dist.rows.filter(x=>x.outcome==='away').reduce((s,x)=>s+x.prob,0);
      const probSum = homeProb + drawProb + awayProb || 1;
      p1 = Math.round(homeProb / probSum * 100);
      p2 = Math.round(awayProb / probSum * 100);
      draw = Math.max(1, 100 - p1 - p2);

      const fav = p1 >= p2 ? match.team1 : match.team2;
      const favSide = p1 >= p2 ? 'home' : 'away';
      const gap = Math.abs(p1 - p2);

      let topOverall = dist.rows
        .filter(x => x.h <= 4 && x.a <= 4)
        .slice(0, 2)
        .map(x => x.score);
const upsetSide = favSide === 'home' ? 'away' : 'home';
      const normalScoreSet = new Set(topOverall);
      let upsetCandidates = dist.rows
        .filter(x => !normalScoreSet.has(x.score))
        .filter(x => x.outcome === upsetSide || x.outcome === 'draw')
        .filter(x => x.prob > .008)
        .slice(0, 3)
        .map(x => x.score);

      if(upsetCandidates.length < 3){
        const extra = favSide === 'home' ? ['1-1','0-1','1-2','2-2','0-0','2-3'] : ['1-1','1-0','2-1','2-2','0-0','3-2'];
        extra.forEach(s=>{
          if(!normalScoreSet.has(s) && !upsetCandidates.includes(s) && upsetCandidates.length < 3) upsetCandidates.push(s);
        });
      }

      return {
        p1, p2, draw, r1, r2, fav, favSide,
        normal: topOverall,
        upset: upsetCandidates,
        xg1: dist.lambda1,
        xg2: dist.lambda2,
        confidence: clamp(Math.round(54 + gap * .9), 52, 82)
      };
    }

    function predictionImportTeamKey(name){
      const n = normalizeTeam(String(name || '').trim());
      const map = {
        "united states":"usa",
        "u.s.":"usa",
        "bosnia and herzegovina":"bosnia & herzegovina",
        "bosnia-herzegovina":"bosnia & herzegovina",
        "czechia":"czech republic",
        "curacao":"curaçao",
        "côte d'ivoire":"ivory coast",
        "cote d'ivoire":"ivory coast",
        "democratic republic of congo":"dr congo",
        "congo dr":"dr congo",
        "korea republic":"south korea",
        "cabo verde":"cape verde",
        "turkiye":"turkey",
        "türkiye":"turkey"
      };
      return map[n] || n;
    }
    function predictionImportGroupKey(group){
      const raw = String(group || '').trim();
      let m = raw.match(/^Group\s+([A-L])$/i);
      if(m) return m[1].toUpperCase();
      m = raw.match(/^([A-L])组$/i);
      if(m) return m[1].toUpperCase();
      m = raw.match(/^([A-L])\s*Grubu$/i);
      if(m) return m[1].toUpperCase();
      m = raw.match(/^([A-L])$/i);
      if(m) return m[1].toUpperCase();
      return raw.toUpperCase();
    }
    function predictionImportCandidateDateKeys(match){
      const keys = [];
      const add = v => { if(v && !keys.includes(v)) keys.push(v); };
      const raw = String(match.date || match.kickoff || '').slice(0, 10);
      add(raw);
      const d = matchDate(match);
      if(d && !isNaN(d.getTime())){
        add(dateKey(d, TZ_MAIN));
        add(dateKey(d, TZ_CHINA));
        const plus = new Date(d.getTime() + 24 * 60 * 60 * 1000);
        const minus = new Date(d.getTime() - 24 * 60 * 60 * 1000);
        add(dateKey(plus, TZ_MAIN));
        add(dateKey(minus, TZ_MAIN));
      }
      return keys.filter(Boolean);
    }

    function importedScorePredictionForMatch(match){
      const group = predictionImportGroupKey(match.group);
      const home = predictionImportTeamKey(match.team1);
      const away = predictionImportTeamKey(match.team2);
      const dates = predictionImportCandidateDateKeys(match);
      for(const d of dates){
        const key = [d, group, home, away].join('|');
        if(IMPORTED_SCORE_PREDICTIONS[key]) return IMPORTED_SCORE_PREDICTIONS[key];
      }
      return null;
    }
    function applyImportedScorePrediction(model, imported){
      if(!imported) return model;
      const normal = imported.normal && imported.normal.length ? imported.normal.slice(0, 2) : model.normal;
      const normalSet = new Set(normal || []);
      let upset = imported.upset && imported.upset.length ? imported.upset.filter(s => !normalSet.has(s)).slice(0, 3) : (model.upset || []);
      if(upset.length < 3){
        (model.upset || []).forEach(s => {
          if(!normalSet.has(s) && !upset.includes(s) && upset.length < 3) upset.push(s);
        });
      }
      return {...model, normal, upset, importedScorePrediction:true};
    }

    function predictionMatchKey(match){
      return [
        match.num || '',
        match.group || '',
        match.round || '',
        match.team1 || '',
        match.team2 || '',
        match.kickoff || match.date || ''
      ].join('|');
    }
    function loadPredictionCache(){
      try{
        const raw = localStorage.getItem(PREDICTION_CACHE_KEY);
        if(!raw) return {};
        const data = JSON.parse(raw);
        return data && typeof data === 'object' ? data : {};
      }catch(e){
        return {};
      }
    }
    function savePredictionCache(cache){
      try{ localStorage.setItem(PREDICTION_CACHE_KEY, JSON.stringify(cache)); }catch(e){}
    }
    function freezePredictionModel(match, model){
      const imported = importedScorePredictionForMatch(match);
      if(imported){
        return applyImportedScorePrediction(model, imported);
      }
      const key = predictionMatchKey(match);
      const cache = loadPredictionCache();
      if(cache[key]){
        return {...model, ...cache[key], frozen:true};
      }
      const frozen = {
        p1:model.p1, p2:model.p2, draw:model.draw,
        r1:model.r1, r2:model.r2,
        fav:model.fav, favSide:model.favSide,
        normal:[...(model.normal || [])],
        upset:[...(model.upset || [])],
        xg1:model.xg1, xg2:model.xg2,
        confidence:model.confidence,
        frozenAt:new Date().toISOString()
      };
      cache[key] = frozen;
      savePredictionCache(cache);
      return {...model, ...frozen, frozen:true};
    }

    function predictionIntro(match, model){
      const dict = PRED_I18N[app.lang] || PRED_I18N.en;
      const score = model.normal[0];
      return dict.outlook(teamName(match.team1), teamName(match.team2), teamName(model.fav), score);
    }
    function factorItems(match, model){
      const a = teamName(match.team1), b = teamName(match.team2);
      const stronger = teamName(model.r1 >= model.r2 ? match.team1 : match.team2);
      const balanced = Math.abs(model.r1 - model.r2) < 5;
      if(app.lang === 'zh'){
        return [
          [pt('modelScore'), `${a} ${Math.round(model.r1)} ｜ ${b} ${Math.round(model.r2)} ｜ xG ${model.xg1.toFixed(1)}-${model.xg2.toFixed(1)}`],
          [pt('attack'), balanced ? '双方差距不大，预计节奏偏谨慎' : `${stronger} 的推进质量更占优`],
          [pt('defense'), model.draw >= 26 ? '平局权重较高，防守细节关键' : '领先方需要控制反击空间'],
          [pt('venue'), `${groundName(match.ground)} · ${groundCountryName(match.ground)}`],
          [pt('tactic'), '建议关注边路推进、定位球和上半场节奏'],
          [pt('risk'), model.confidence < 62 ? '爆冷概率中等，需要防平局' : '热门方向较清晰，但仍需防小比分']
        ];
      }
      if(app.lang === 'tr'){
        return [
          [pt('modelScore'), `${a} ${Math.round(model.r1)} ｜ ${b} ${Math.round(model.r2)} ｜ xG ${model.xg1.toFixed(1)}-${model.xg2.toFixed(1)}`],
          [pt('attack'), balanced ? 'Takımlar yakın, tempo daha kontrollü olabilir' : `${stronger} hücum geçişlerinde önde`],
          [pt('defense'), model.draw >= 26 ? 'Beraberlik ağırlığı yüksek, savunma detayları kritik' : 'Öne geçen takım kontra boşluğunu kontrol etmeli'],
          [pt('venue'), `${groundName(match.ground)} · ${groundCountryName(match.ground)}`],
          [pt('tactic'), 'Kanatlar, duran toplar ve ilk yarı temposu belirleyici olabilir'],
          [pt('risk'), model.confidence < 62 ? 'Sürpriz ihtimali orta; beraberliğe dikkat' : 'Favori taraf netleşiyor, yine de düşük skora dikkat']
        ];
      }
      return [
        [pt('modelScore'), `${a} ${Math.round(model.r1)} | ${b} ${Math.round(model.r2)} | xG ${model.xg1.toFixed(1)}-${model.xg2.toFixed(1)}`],
        [pt('attack'), balanced ? 'The matchup is close, so the tempo may stay controlled' : `${stronger} has a stronger attacking profile`],
        [pt('defense'), model.draw >= 26 ? 'Draw probability is meaningful; defensive details matter' : 'The leading side must manage counterattack space'],
        [pt('venue'), `${groundName(match.ground)} · ${groundCountryName(match.ground)}`],
        [pt('tactic'), 'Watch wide attacks, set pieces and first-half tempo'],
        [pt('risk'), model.confidence < 62 ? 'Medium upset risk; draw protection is useful' : 'Favorite direction is clearer, but low score is possible']
      ];
    }
    function lineupLabels(){
      if(app.lang === 'zh') return ['门将','后卫','后卫','后卫','后卫','中场','中场','中场','中场','前锋','前锋'];
      if(app.lang === 'tr') return ['Kale','Def','Def','Def','Def','Orta','Orta','Orta','Orta','For','For'];
      return ['GK','DF','DF','DF','DF','MID','MID','MID','MID','FW','FW'];
    }
    function renderPitch(team){
      const names = lineupLabels();
      const pos = [
        [50,90],[20,72],[40,72],[60,72],[80,72],
        [20,50],[40,50],[60,50],[80,50],
        [38,27],[62,27]
      ];
      const dots = pos.map((p,i)=>`<div class="player-dot" style="left:${p[0]}%;top:${p[1]}%">${i+1}<span>${esc(names[i])}</span></div>`).join('');
      return `<div class="pitch">${dots}<div class="pitch-tag">4-4-2 · ${esc(teamName(team))}</div></div>`;
    }
    function scorePickMeta(score, match){
      const parts = String(score).split('-').map(x=>Number(x));
      const h = Number(parts[0]), a = Number(parts[1]);
      if(h > a) return {side:'home', team:teamName(match.team1), desc:pt('homeWin')};
      if(h < a) return {side:'away', team:teamName(match.team2), desc:pt('awayWin')};
      return {side:'draw', team:pt('draw'), desc:pt('draw')};
    }
    function renderScorePickCards(scores, match, kind){
      return (scores || []).map((score, idx) => {
        const meta = scorePickMeta(score, match);
        const tag = kind === 'normal'
          ? (idx === 0 ? pt('mainPick') : pt('secondPick'))
          : (meta.side === 'draw' ? pt('drawGuard') : pt('upsetWatch'));
        return `<div class="score-pick-card ${esc(meta.side)}">
          <div class="score-pick-tag">${esc(tag)}</div>
          <div class="score-pick-score">${esc(score)}</div>
          <div class="score-pick-team">${esc(meta.team)}</div>
          <div class="score-pick-desc">${esc(meta.desc)}</div>
        </div>`;
      }).join('');
    }
    function confidenceLabel(model){
      const top = Math.max(model.p1, model.p2);
      if(app.lang === 'zh') return top >= 58 ? '方向较清晰' : (top >= 46 ? '中等参考' : '谨慎参考');
      if(app.lang === 'tr') return top >= 58 ? 'Yön net' : (top >= 46 ? 'Orta güven' : 'Temkinli');
      return top >= 58 ? 'Clearer edge' : (top >= 46 ? 'Medium confidence' : 'Cautious');
    }
    function quickReasons(match, model){
      const stronger = teamName(model.r1 >= model.r2 ? match.team1 : match.team2);
      const fav = teamName(model.fav);
      const close = Math.abs(model.r1 - model.r2) < 5;
      if(app.lang === 'zh'){
        return [
          close ? '双方实力接近，平局权重偏高' : `${stronger} 综合评分更占优`,
          `${fav} 是当前更优方向，但概率未到绝对优势`,
          '杯赛场景偏谨慎，小比分更值得优先参考'
        ];
      }
      if(app.lang === 'tr'){
        return [
          close ? 'Takımlar yakın; beraberlik ağırlığı yüksek' : `${stronger} modelde öne çıkıyor`,
          `${fav} daha iyi yön, ancak mutlak üstünlük değil`,
          'Turnuva maçlarında düşük skor öncelikli izlenmeli'
        ];
      }
      return [
        close ? 'Teams are close, so draw weight is meaningful' : `${stronger} has the stronger model rating`,
        `${fav} is the better direction, but not a lock`,
        'Tournament context favors lower-score outcomes'
      ];
    }
    function renderReasonChips(match, model){
      return quickReasons(match, model).map(x=>`<div class="reason-chip">${esc(x)}</div>`).join('');
    }
    function predictionLiveText(key){
      const dict = {
        zh:{
          liveOverview:'直播概览', liveRefresh:'刷新直播', currentScore:'当前比分', matchClock:'比赛时间', matchStatus:'比赛状态', source:'数据源', updated:'更新时间', timeline:'直播事件', noTimeline:'暂无详细图文事件；如果实时接口返回进球球员，会自动显示在这里。', notStarted:'比赛尚未开始', notStartedHint:'直播页会在临近开赛和比赛进行中自动更新比分与事件。', finishedHint:'比赛已结束，以下为最终比分和已获取到的事件。', liveHint:'比赛进行中，比分会自动刷新，也可以手动刷新。', waiting:'等待直播数据', noScore:'暂无比分', kickoff:'开球时间', venue:'比赛地点', eventId:'赛事ID', goal:'进球', ownGoal:'乌龙球'
        },
        en:{
          liveOverview:'Live Overview', liveRefresh:'Refresh Live', currentScore:'Current Score', matchClock:'Match Clock', matchStatus:'Status', source:'Data source', updated:'Updated', timeline:'Live Timeline', noTimeline:'No detailed live-text events yet. Scorers will appear here automatically when the feed returns them.', notStarted:'Match has not started', notStartedHint:'The live tab will update scores and events near kickoff and during the match.', finishedHint:'The match is complete. Final score and available events are shown below.', liveHint:'The match is live. Scores refresh automatically, or you can refresh manually.', waiting:'Waiting for live data', noScore:'No score yet', kickoff:'Kickoff', venue:'Venue', eventId:'Event ID', goal:'Goal', ownGoal:'Own goal'
        },
        tr:{
          liveOverview:'Canlı Özet', liveRefresh:'Canlıyı Yenile', currentScore:'Güncel Skor', matchClock:'Maç Saati', matchStatus:'Durum', source:'Veri kaynağı', updated:'Güncellendi', timeline:'Canlı Akış', noTimeline:'Henüz ayrıntılı canlı olay yok. Veri golcüleri döndürdüğünde burada otomatik görünür.', notStarted:'Maç henüz başlamadı', notStartedHint:'Canlı sekmesi başlama saatine yakın ve maç sırasında skorları ve olayları günceller.', finishedHint:'Maç bitti. Final skoru ve alınabilen olaylar aşağıda gösterilir.', liveHint:'Maç canlı. Skor otomatik yenilenir veya elle yenileyebilirsiniz.', waiting:'Canlı veri bekleniyor', noScore:'Henüz skor yok', kickoff:'Başlama', venue:'Saha', eventId:'Maç ID', goal:'Gol', ownGoal:'Kendi kalesine'
        }
      };
      return (dict[app.lang] && dict[app.lang][key]) || dict.en[key] || key;
    }
    function currentPredictionMatch(){
      const idx = Number(app.predictionIndex);
      const raw = matchItems()[idx] || app.matches[idx];
      if(!raw) return null;
      return raw._date instanceof Date ? raw : createMatchItem(raw, idx);
    }
    function matchScoreParts(match, score){
      let s1 = scoreForTeam(score, match.team1);
      let s2 = scoreForTeam(score, match.team2);
      if(score && (s1 === '' || s2 === '') && score.homeScore !== '' && score.awayScore !== ''){
        const t1 = normalizeTeam(match.team1);
        const t2 = normalizeTeam(match.team2);
        if(t1 === score.home && t2 === score.away){
          s1 = score.homeScore;
          s2 = score.awayScore;
        }else if(t1 === score.away && t2 === score.home){
          s1 = score.awayScore;
          s2 = score.homeScore;
        }
      }
      return {s1, s2, hasScore: s1 !== '' && s2 !== '' && s1 != null && s2 != null};
    }
    function minuteNumber(value){
      const m = String(value || '').match(/\d+/);
      return m ? Number(m[0]) : 999;
    }
    function predictionTimelineEvents(match){
      const eventId = String(espnEventIdForMatch(match) || '');
      if(!eventId) return [];
      return Object.values(app.playerEvents || {}).filter(ev => {
        if(!ev) return false;
        return String(ev.eventId || '') === eventId || String(ev.matchKey || '') === eventId;
      }).sort((a,b)=>minuteNumber(a.minute)-minuteNumber(b.minute));
    }
    function renderPredictionTimeline(match){
      const events = predictionTimelineEvents(match);
      if(!events.length){
        return `<div class="live-empty-box"><div>${esc(predictionLiveText('waiting'))}</div><p>${esc(predictionLiveText('noTimeline'))}</p></div>`;
      }
      const home = normalizeTeam(match.team1), away = normalizeTeam(match.team2);
      return `<div class="prediction-live-timeline">${events.map(ev => {
        const nTeam = normalizeTeam(ev.team || '');
        const side = nTeam === away ? 'away' : 'home';
        const team = nTeam === away ? match.team2 : (nTeam === home ? match.team1 : ev.team);
        const minute = ev.minute ? String(ev.minute) : '—';
        const kind = /own/i.test(String(ev.kind || '')) ? predictionLiveText('ownGoal') : predictionLiveText('goal');
        return `<div class="prediction-live-event ${esc(side)}">
          <div class="prediction-live-minute">${esc(minute)}</div>
          <div class="prediction-live-dot">⚽</div>
          <div class="prediction-live-event-main">
            <strong>${esc(ev.player || kind)}</strong>
            <span>${tinyFlagHtml(team)}${esc(teamName(team))} · ${esc(kind)}</span>
          </div>
        </div>`;
      }).join('')}</div>`;
    }
    function renderPredictionLiveContent(match, score, st){
      const parts = matchScoreParts(match, score);
      const statusLabel = st === 'finished' ? t('finished') : (scoreDetailText(score, st) || (st === 'live' ? t('live') : t('upcoming')));
      const mainTz = primaryTimeZone();
      const secondTz = secondaryTimeZone();
      const scoreText = parts.hasScore ? `${parts.s1}-${parts.s2}` : predictionLiveText('noScore');
      const hint = st === 'live' ? predictionLiveText('liveHint') : (st === 'finished' ? predictionLiveText('finishedHint') : predictionLiveText('notStartedHint'));
      const sourceText = app.scoreSource && app.scoreSource !== 'none' ? app.scoreSource : t('scoreNone');
      const updatedText = score && score.updatedAt ? fmtDateTime(new Date(score.updatedAt), mainTz) : scoreUpdatedText();
      const eventId = espnEventIdForMatch(match) || '—';
      return `
        <section class="prediction-card prediction-live-card">
          <div class="prediction-live-head">
            <div>
              <div class="conclusion-eyebrow">${esc(predictionLiveText('liveOverview'))}</div>
              <h3 class="conclusion-title">${esc(st === 'upcoming' ? predictionLiveText('notStarted') : scoreText)}</h3>
              <p class="conclusion-copy">${esc(hint)}</p>
            </div>
            <button class="prediction-live-refresh" id="predictionLiveRefreshBtn" type="button">${app.predictionLiveLoading ? '…' : esc(predictionLiveText('liveRefresh'))}</button>
          </div>
          <div class="prediction-live-scoreline">
            <div class="prediction-live-team left">${tinyFlagHtml(match.team1)}<span>${esc(teamName(match.team1))}</span><strong>${parts.hasScore ? esc(parts.s1) : '-'}</strong></div>
            <div class="prediction-live-center"><span>${esc(statusLabel)}</span><b>VS</b></div>
            <div class="prediction-live-team right"><strong>${parts.hasScore ? esc(parts.s2) : '-'}</strong><span>${esc(teamName(match.team2))}</span>${tinyFlagHtml(match.team2)}</div>
          </div>
          <div class="prediction-live-grid">
            <div class="prediction-live-stat"><span>${esc(predictionLiveText('matchStatus'))}</span><strong>${esc(statusLabel)}</strong></div>
            <div class="prediction-live-stat"><span>${esc(predictionLiveText('kickoff'))}</span><strong>${esc(timeZoneLabel(mainTz))}: ${esc(fmtTime(match._date, mainTz))}</strong></div>
            <div class="prediction-live-stat"><span>${esc(predictionLiveText('updated'))}</span><strong>${esc(updatedText)}</strong></div>
            <div class="prediction-live-stat"><span>${esc(predictionLiveText('source'))}</span><strong>${esc(sourceText)}</strong></div>
            <div class="prediction-live-stat wide"><span>${esc(predictionLiveText('venue'))}</span><strong>${esc(groundName(match.ground))}${groundCountryName(match.ground) ? ' · ' + esc(groundCountryName(match.ground)) : ''}</strong></div>
            <div class="prediction-live-stat"><span>${esc(predictionLiveText('eventId'))}</span><strong>${esc(eventId)}</strong></div>
          </div>
          <div class="prediction-status soft">${esc(timeZoneLabel(secondTz))}: ${esc(fmtDateTime(match._date, secondTz))}</div>
        </section>
        <section class="prediction-card prediction-live-card">
          <div class="prediction-live-section-title"><h3>${esc(predictionLiveText('timeline'))}</h3><span>${esc(statusLabel)}</span></div>
          ${renderPredictionTimeline(match)}
        </section>
      `;
    }
    function refreshPredictionLiveData(){
      const match = currentPredictionMatch();
      if(!match || app.predictionLiveLoading) return $.Deferred().resolve().promise();
      app.predictionLiveLoading = true;
      if(app.predictionTab === 'live') renderPredictionPage();
      const id = espnEventIdForMatch(match);
      const req = id ? fetchScoreJson(ESPN_SUMMARY, {event:id, _:Date.now()}, true).then(data => {
        mergeScoreMaps(parseEspnSummary(data), parseEspnDeepScores(data));
        mergePlayerEvents(extractPlayerEventsFromEspn(data));
        saveScoreCache();
        return {ok:true};
      }, () => refreshScoresOnce()) : refreshScoresOnce();
      return req.always(() => {
        app.predictionLiveLoading = false;
        if(app.predictionIndex !== null && app.predictionTab === 'live' && !$('#predictionPage').hasClass('hidden')) renderPredictionPage();
      });
    }

    function imageText(key){ return t(key); }
    function cloudCleanBase(url){ return String(url || '').trim().replace(/\/+$/, ''); }
    function isCloudConfigReady(cfg){
      const base = cloudCleanBase(cfg && cfg.workerBaseUrl);
      return !!base && !/your-worker|example|请填写|填入|你的|workers\.dev\/xxx/i.test(base);
    }
    function withCacheBust(url){
      const sep = String(url || '').includes('?') ? '&' : '?';
      return `${url}${sep}_=${Date.now()}`;
    }
    function cloudImageUrl(path, img, mode='view'){
      const version = img && (img.sha || img.updatedAt || img.createdAt || img.size || '');
      const base = `${cloudApi('/api/image')}?path=${encodeURIComponent(path || '')}`;
      return `${base}&v=${encodeURIComponent(version)}&mode=${encodeURIComponent(mode)}&_=${Date.now()}`;
    }
    function ajaxErrorMessage(xhr, fallback){
      const status = xhr && xhr.status ? `HTTP ${xhr.status}` : '';
      let msg = '';
      try{
        if(xhr && xhr.responseJSON && xhr.responseJSON.message) msg = xhr.responseJSON.message;
        else if(xhr && xhr.responseText){
          const parsed = JSON.parse(xhr.responseText);
          msg = parsed && parsed.message ? parsed.message : xhr.responseText;
        }
      }catch(e){ msg = xhr && xhr.responseText ? String(xhr.responseText).slice(0, 160) : ''; }
      const detail = [status, msg].filter(Boolean).join('：');
      return detail ? `${fallback}（${detail}）` : fallback;
    }
    function loadCloudConfig(force=false){
      if(app.cloudConfig && !force) return $.Deferred().resolve(app.cloudConfig).promise();
      if(app.cloudConfigLoading && !force) return app.cloudConfigLoading;
      const dfd = $.Deferred();
      app.cloudConfigLoading = dfd.promise();
      const cfgUrl = withCacheBust(CLOUD_CONFIG_URL);
      $.ajax({url:cfgUrl, dataType:'json', cache:false, timeout:8000})
        .done(cfg => {
          app.cloudConfig = Object.assign({enabled:true, workerBaseUrl:'', appPassword:'', imageRoot:'worldcup-cloud/match-images', maxImageWidth:MATCH_IMAGE_DEFAULT_MAX_WIDTH, jpegQuality:MATCH_IMAGE_DEFAULT_QUALITY}, cfg || {});
          try{ localStorage.setItem(CLOUD_CONFIG_CACHE_KEY, JSON.stringify(app.cloudConfig)); }catch(e){}
          dfd.resolve(app.cloudConfig);
        })
        .fail(xhr => {
          try{
            const cached = JSON.parse(localStorage.getItem(CLOUD_CONFIG_CACHE_KEY) || 'null');
            if(cached){
              app.cloudConfig = cached;
              dfd.resolve(app.cloudConfig);
              return;
            }
          }catch(e){}
          app.cloudConfig = {enabled:false, workerBaseUrl:'', appPassword:'', imageRoot:'worldcup-cloud/match-images', maxImageWidth:MATCH_IMAGE_DEFAULT_MAX_WIDTH, jpegQuality:MATCH_IMAGE_DEFAULT_QUALITY};
          dfd.resolve(app.cloudConfig);
        })
        .always(() => { app.cloudConfigLoading = null; });
      return dfd.promise();
    }
    function cloudApi(path){
      const cfg = app.cloudConfig || {};
      const base = cloudCleanBase(cfg.workerBaseUrl);
      return base + path;
    }
    function safePathPart(value){
      const raw = String(value || '').trim().toLowerCase();
      const plain = raw.normalize ? raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : raw;
      return plain.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'team';
    }
    function matchCloudKey(match){
      const d = match && match._date instanceof Date ? match._date : parseKickoff(match || {});
      const day = d && !isNaN(d.getTime()) ? dateKey(d, TZ_MAIN) : 'unknown-date';
      const num = match && (match.num || match.matchday || match._idx + 1);
      const numPart = num ? `m${String(num).replace(/[^0-9a-zA-Z]+/g, '').padStart(2,'0')}` : `idx${match && match._idx != null ? match._idx : 0}`;
      return `${day}-${numPart}-${safePathPart(match && match.team1)}-vs-${safePathPart(match && match.team2)}`;
    }
    function imageCacheKey(matchKey){ return MATCH_IMAGE_CACHE_PREFIX + matchKey; }
    function renderMatchImagesShell(match){
      const key = matchCloudKey(match);
      return `
        <section class="prediction-card match-images-card" data-match-key="${esc(key)}">
          <div class="match-images-head">
            <div>
              <h3>${esc(imageText('matchImages'))}</h3>
              <p>${esc(imageText('matchImagesHint'))}</p>
            </div>
            <div class="match-images-actions">
              <button class="match-image-btn" id="matchImageUploadBtn" type="button">${esc(imageText('uploadImages'))}</button>
              <button class="match-image-btn ghost" id="matchImageRefreshBtn" type="button">${esc(imageText('refreshImages'))}</button>
              <input id="matchImageFileInput" class="match-image-file" type="file" accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.gif,.bmp" multiple>
            </div>
          </div>
          <div class="match-image-status" id="matchImageStatus">${esc(imageText('imageLoading'))}</div>
          <div class="match-image-grid" id="matchImageGrid"></div>
        </section>`;
    }
    function setMatchImageStatus(text, tone=''){
      $('#matchImageStatus').removeClass('ok error').addClass(tone || '').text(text || '');
    }
    function renderMatchImageGrid(matchKey, images){
      const list = Array.isArray(images) ? images : [];
      const $grid = $('#matchImageGrid');
      if(!$grid.length) return;
      if(!list.length){
        $grid.html(`<div class="match-image-empty">${esc(imageText('imageEmpty'))}</div>`);
        return;
      }
      const html = list.map((img, idx) => {
        const path = img.path || img.githubPath || img.filePath || img.fileName || '';
        const title = img.createdAt ? formatImageTime(img.createdAt) : (img.fileName || img.id || '');
        const url = cloudImageUrl(path, img, 'thumb');
        return `<div class="match-image-item" data-image-index="${idx}" title="${esc(title)}">
          <button class="match-image-thumb" type="button" data-image-index="${idx}" aria-label="${esc(imageText('imageOpen'))}">
            <img src="${esc(url)}" alt="${esc(imageText('imageOpen'))}" loading="lazy" decoding="async">
          </button>
          <div class="match-image-meta">
            <span>${esc(title || imageText('matchImages'))}</span>
            <button class="match-image-delete" type="button" data-image-index="${idx}">${esc(imageText('imageDelete'))}</button>
          </div>
        </div>`;
      }).join('');
      $grid.html(html);
    }
    function formatImageTime(value){
      const d = new Date(value);
      if(isNaN(d.getTime())) return String(value || '');
      try{return new Intl.DateTimeFormat(localeForLang(), {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}).format(d);}catch(e){return d.toLocaleString();}
    }
    function loadMatchImagesForCurrent(force=false){
      const match = currentPredictionMatch();
      if(!match) return;
      return loadMatchImages(match, force);
    }
    function loadMatchImages(match, force=false){
      const matchKey = matchCloudKey(match);
      // v9: every time the odds/image tab opens, always request the latest manifest from Worker/GitHub.
      // Do not preload stale localStorage image manifests, otherwise deleted/replaced screenshots may look old.
      setMatchImageStatus(imageText('imageLoading'));
      renderMatchImageGrid(matchKey, []);
      return loadCloudConfig(force || !isCloudConfigReady(app.cloudConfig)).then(cfg => {
        if(!cfg || cfg.enabled === false || !isCloudConfigReady(cfg)){
          setMatchImageStatus(imageText('imageConfigMissing'), 'error');
          renderMatchImageGrid(matchKey, []);
          return;
        }
        const listUrl = withCacheBust(cloudApi(`/api/matches/${encodeURIComponent(matchKey)}/images`));
        return $.ajax({url:listUrl, dataType:'json', cache:false, timeout:15000})
          .done(res => {
            const active = $('.match-images-card').data('match-key');
            if(active && String(active) !== matchKey) return;
            const images = Array.isArray(res && res.images) ? res.images : [];
            app.matchImages[matchKey] = images;
            try{ localStorage.removeItem(imageCacheKey(matchKey)); }catch(e){}
            setMatchImageStatus(images.length ? imageText('imageUploadReady') : imageText('imageEmpty'), images.length ? 'ok' : '');
            renderMatchImageGrid(matchKey, images);
          })
          .fail(xhr => {
            setMatchImageStatus(ajaxErrorMessage(xhr, imageText('imageLoadFail')), 'error');
          });
      });
    }
    function initMatchImages(match){
      const active = $('.match-images-card').data('match-key');
      if(!active) return;
      loadMatchImages(match, false);
    }
    function readFileAsDataUrl(file){
      const dfd = $.Deferred();
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        dfd.resolve(result);
      };
      reader.onerror = () => {
        dfd.reject(reader.error || new Error('read failed'));
      };
      reader.readAsDataURL(file);
      return dfd.promise();
    }
    function loadImageElement(dataUrl){
      const dfd = $.Deferred();
      const img = new Image();
      img.onload = () => dfd.resolve(img);
      img.onerror = () => dfd.reject(new Error('image decode failed'));
      img.src = dataUrl;
      return dfd.promise();
    }
    function imageExtensionFromFile(file){
      const name = String(file && file.name || '').toLowerCase();
      const ext = (name.match(/\.([a-z0-9]+)$/) || [,'jpg'])[1];
      if(['jpg','jpeg','png','webp','gif','heic','heif','avif','bmp','tif','tiff'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
      return 'jpg';
    }
    function imageContentTypeFromFile(file, fallback='image/jpeg'){
      const type = String(file && file.type || '').trim();
      if(/^image\//i.test(type)) return type;
      const ext = imageExtensionFromFile(file);
      if(ext === 'png') return 'image/png';
      if(ext === 'webp') return 'image/webp';
      if(ext === 'gif') return 'image/gif';
      if(ext === 'heic') return 'image/heic';
      if(ext === 'heif') return 'image/heif';
      if(ext === 'avif') return 'image/avif';
      if(ext === 'bmp') return 'image/bmp';
      if(ext === 'tif' || ext === 'tiff') return 'image/tiff';
      return fallback;
    }
    function createImageUploadId(){
      const stamp = new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
      const rand = Math.random().toString(36).slice(2,8);
      return `${stamp}-${rand}`;
    }
    function rawImageFilePayload(file){
      return readFileAsDataUrl(file).then(dataUrl => {
        const base64 = String(dataUrl || '').split(',')[1] || '';
        const ext = imageExtensionFromFile(file);
        const imageId = createImageUploadId();
        const payload = {
          id: imageId,
          fileName: `${imageId}.${ext === 'jpeg' ? 'jpg' : ext}`,
          contentType: imageContentTypeFromFile(file),
          base64,
          width: null,
          height: null,
          originalName: file.name || '',
          originalSize: file.size || 0,
          size: file.size || Math.round(base64.length * 3 / 4),
          rawUpload: true,
          preserveOriginal: true
        };
        return loadImageElement(dataUrl).then(img => {
          payload.width = img.naturalWidth || img.width || null;
          payload.height = img.naturalHeight || img.height || null;
          return payload;
        }, () => payload);
      });
    }
    function compressImageFile(file, cfg){
      // v9: keep original image quality. Image viewer renders from natural pixels, not thumbnail/cache.
      // Do not use canvas/toDataURL compression, otherwise long screenshots become blurry after zooming.
      return rawImageFilePayload(file);
    }
    function uploadMatchImages(files){
      const match = currentPredictionMatch();
      if(!match || !files || !files.length) return;
      const matchKey = matchCloudKey(match);
      const selected = Array.from(files || []);
      setMatchImageStatus(imageText('imageUploading'));
      return loadCloudConfig(true).then(cfg => {
        if(!cfg || !isCloudConfigReady(cfg)){
          setMatchImageStatus(imageText('imageConfigMissing'), 'error');
          return;
        }
        const arr = selected;
        if(!arr.length){
          setMatchImageStatus('没有选择文件，请重新选择图片。', 'error');
          return;
        }
        const jobs = arr.map(file => Promise.resolve(compressImageFile(file, cfg)));
        return Promise.all(jobs).then(images => {
          const validImages = images.filter(x => x && x.base64);
          if(!validImages.length){
            setMatchImageStatus(imageText('imageEncodeFail'), 'error');
            return;
          }
          const uploadUrl = cloudApi(`/api/matches/${encodeURIComponent(matchKey)}/images`);
          const totalBase64 = validImages.reduce((sum, x) => sum + String(x.base64 || '').length, 0);
          return $.ajax({
            url: uploadUrl,
            method: 'POST',
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            timeout: 90000,
            data: JSON.stringify({password: cfg.appPassword || '', images: validImages})
          }).done(res => {
            setMatchImageStatus(imageText('imageUploadDone'), 'ok');
            loadMatchImages(match, true);
          }).fail((xhr, textStatus, errorThrown) => {
            setMatchImageStatus(ajaxErrorMessage(xhr, imageText('imageUploadFail')), 'error');
          });
        }).catch(err => {
          setMatchImageStatus(`${imageText('imageUploadFail')}（${err && err.message ? err.message : 'prepare failed'}）`, 'error');
        });
      });
    }
    function ensureImageViewer(){
      if($('#matchImageViewer').length) return;
      $('body').append(`
        <div class="match-image-viewer hidden" id="matchImageViewer" aria-hidden="true">
          <div class="match-image-viewer-backdrop" data-viewer-action="close"></div>
          <div class="match-image-viewer-panel">
            <button class="match-image-viewer-close" id="matchImageViewerClose" type="button" data-viewer-action="close" aria-label="${esc(imageText('imageClose'))}">×</button>
            <div class="match-image-viewer-stage" id="matchImageViewerStage"><img id="matchImageViewerImg" alt="${esc(imageText('imageOpen'))}"></div>
            <div class="match-image-viewer-toolbar">
              <button type="button" data-viewer-action="prev">${esc(imageText('imagePrev'))}</button>
              <button type="button" data-viewer-action="zoomOut">−</button>
              <button type="button" data-viewer-action="reset">${esc(imageText('imageReset'))}</button>
              <button type="button" data-viewer-action="zoomIn">＋</button>
              <button type="button" data-viewer-action="next">${esc(imageText('imageNext'))}</button>
            </div>
          </div>
        </div>`);
      bindImageViewerTouchEvents();
    }
    function currentViewerImages(){
      const key = app.imageViewer.key;
      return (app.matchImages && app.matchImages[key]) || [];
    }
    function viewerState(){
      if(!app.imageViewer) app.imageViewer = {key:'', index:0, scale:1, x:0, y:0, touch:null};
      if(typeof app.imageViewer.scale !== 'number' || !isFinite(app.imageViewer.scale)) app.imageViewer.scale = 1;
      if(typeof app.imageViewer.x !== 'number' || !isFinite(app.imageViewer.x)) app.imageViewer.x = 0;
      if(typeof app.imageViewer.y !== 'number' || !isFinite(app.imageViewer.y)) app.imageViewer.y = 0;
      return app.imageViewer;
    }
    function clampViewerScale(value){
      const n = Number(value);
      return Number.isFinite(n) ? Math.max(1, n) : 1;
    }
    function viewerStageRect(){
      const stage = document.getElementById('matchImageViewerStage');
      return stage ? stage.getBoundingClientRect() : {left:0, top:0, width:1, height:1};
    }
    function viewerFitScale(){
      const imgEl = document.getElementById('matchImageViewerImg');
      const rect = viewerStageRect();
      const nw = imgEl && imgEl.naturalWidth ? imgEl.naturalWidth : 0;
      const nh = imgEl && imgEl.naturalHeight ? imgEl.naturalHeight : 0;
      if(!nw || !nh || !rect.width || !rect.height) return 1;
      // Keep the initial view fully visible, but never upscale a small original image by default.
      return Math.min(rect.width / nw, rect.height / nh, 1);
    }
    function viewerDisplayScale(userScale){
      return viewerFitScale() * clampViewerScale(userScale);
    }
    function applyViewerTransform(){
      const st = viewerState();
      if(st.scale <= 1.001){ st.scale = 1; st.x = 0; st.y = 0; }
      const imgEl = document.getElementById('matchImageViewerImg');
      const nw = imgEl && imgEl.naturalWidth ? imgEl.naturalWidth : 0;
      const nh = imgEl && imgEl.naturalHeight ? imgEl.naturalHeight : 0;
      const displayScale = viewerDisplayScale(st.scale || 1);
      if(imgEl && nw && nh){
        imgEl.style.width = `${nw}px`;
        imgEl.style.height = `${nh}px`;
        imgEl.style.maxWidth = 'none';
        imgEl.style.maxHeight = 'none';
        imgEl.style.transform = `translate(-50%, -50%) translate3d(${st.x}px, ${st.y}px, 0) scale(${displayScale})`;
      }else{
        $('#matchImageViewerImg').css('transform', `translate(-50%, -50%) translate3d(${st.x}px, ${st.y}px, 0) scale(${displayScale})`);
      }
      $('#matchImageViewer').toggleClass('is-zoomed', st.scale > 1.001);
    }
    function resetViewerTransform(){
      const st = viewerState();
      st.scale = 1; st.x = 0; st.y = 0; st.touch = null;
      applyViewerTransform();
    }
    function zoomViewerTo(nextScale, clientX, clientY){
      const st = viewerState();
      const oldScale = clampViewerScale(st.scale || 1);
      const newScale = clampViewerScale(nextScale);
      if(Math.abs(newScale - oldScale) < 0.0001) return;
      const rect = viewerStageRect();
      const fit = viewerFitScale();
      if(clientX != null && clientY != null && fit > 0){
        const cx = clientX - (rect.left + rect.width / 2);
        const cy = clientY - (rect.top + rect.height / 2);
        const oldDisplay = Math.max(0.0001, fit * oldScale);
        const newDisplay = Math.max(0.0001, fit * newScale);
        st.x = cx - ((cx - (st.x || 0)) * newDisplay / oldDisplay);
        st.y = cy - ((cy - (st.y || 0)) * newDisplay / oldDisplay);
      }
      st.scale = newScale;
      if(st.scale <= 1.001){ st.x = 0; st.y = 0; }
      applyViewerTransform();
    }
    function renderViewerImage(){
      const images = currentViewerImages();
      const img = images[app.imageViewer.index];
      if(!img) return;
      const path = img.path || img.githubPath || img.filePath || img.fileName || '';
      const url = cloudImageUrl(path, img, 'original');
      const $img = $('#matchImageViewerImg');
      $img.off('load.matchViewer error.matchViewer')
        .css({width:'',height:'',maxWidth:'none',maxHeight:'none',transform:'translate(-50%, -50%) scale(1)'});
      $img.on('load.matchViewer', function(){
        const st = viewerState();
        st.scale = 1; st.x = 0; st.y = 0; st.touch = null;
        applyViewerTransform();
      });
      $img.on('error.matchViewer', function(){ setMatchImageStatus(imageText('imageLoadFail'), 'error'); });
      $img.attr('src', url);
    }
    function openImageViewer(matchKey, index){
      ensureImageViewer();
      app.imageViewer = {key: matchKey, index: Number(index) || 0, scale: 1, x:0, y:0, touch:null};
      $('body').addClass('match-image-viewer-open');
      $('#matchImageViewer').removeClass('hidden touching is-zoomed').attr('aria-hidden','false');
      renderViewerImage();
    }
    function closeImageViewer(){
      $('body').removeClass('match-image-viewer-open');
      $('#matchImageViewer').addClass('hidden').removeClass('touching is-zoomed').attr('aria-hidden','true');
      $('#matchImageViewerImg').attr('src','').css('transform','');
      if(app.imageViewer) app.imageViewer.touch = null;
    }
    function viewerMove(delta){
      const images = currentViewerImages();
      if(!images.length) return;
      app.imageViewer.index = (app.imageViewer.index + delta + images.length) % images.length;
      app.imageViewer.scale = 1;
      app.imageViewer.x = 0;
      app.imageViewer.y = 0;
      app.imageViewer.touch = null;
      renderViewerImage();
    }
    function viewerZoom(delta, originEvent){
      const st = viewerState();
      const next = clampViewerScale((st.scale || 1) + delta);
      const ev = originEvent && (originEvent.originalEvent || originEvent);
      zoomViewerTo(next, ev && ev.clientX, ev && ev.clientY);
    }
    function touchDistance(touches){
      if(!touches || touches.length < 2) return 0;
      const a = touches[0], b = touches[1];
      const dx = b.clientX - a.clientX;
      const dy = b.clientY - a.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function touchMidpoint(touches){
      if(!touches || touches.length < 2) return {x:0,y:0};
      return {x:(touches[0].clientX + touches[1].clientX) / 2, y:(touches[0].clientY + touches[1].clientY) / 2};
    }
    function bindImageViewerTouchEvents(){
      if(window.__matchImageViewerTouchReady) return;
      const stage = document.getElementById('matchImageViewerStage');
      if(!stage) return;
      window.__matchImageViewerTouchReady = true;
      stage.addEventListener('touchstart', function(e){
        if($('#matchImageViewer').hasClass('hidden')) return;
        const st = viewerState();
        if(e.touches && e.touches.length >= 2){
          e.preventDefault();
          const mid = touchMidpoint(e.touches);
          st.touch = {mode:'pinch', startDistance:touchDistance(e.touches), startScale:st.scale || 1, startX:st.x || 0, startY:st.y || 0, startMidX:mid.x, startMidY:mid.y};
          $('#matchImageViewer').addClass('touching');
        }else if(e.touches && e.touches.length === 1){
          const t0 = e.touches[0];
          st.touch = {mode:'pan', startClientX:t0.clientX, startClientY:t0.clientY, startX:st.x || 0, startY:st.y || 0};
          $('#matchImageViewer').addClass('touching');
        }
      }, {passive:false});
      stage.addEventListener('touchmove', function(e){
        if($('#matchImageViewer').hasClass('hidden')) return;
        const st = viewerState();
        if(e.touches && e.touches.length >= 2){
          e.preventDefault();
          if(!st.touch || st.touch.mode !== 'pinch'){
            const mid0 = touchMidpoint(e.touches);
            st.touch = {mode:'pinch', startDistance:touchDistance(e.touches), startScale:st.scale || 1, startX:st.x || 0, startY:st.y || 0, startMidX:mid0.x, startMidY:mid0.y};
          }
          const dist = touchDistance(e.touches);
          const startDist = Math.max(1, st.touch.startDistance || dist || 1);
          const mid = touchMidpoint(e.touches);
          const nextScale = clampViewerScale((st.touch.startScale || 1) * (dist / startDist));
          const rect = viewerStageRect();
          const fit = viewerFitScale();
          if(fit > 0){
            const startCx = (st.touch.startMidX || mid.x) - (rect.left + rect.width / 2);
            const startCy = (st.touch.startMidY || mid.y) - (rect.top + rect.height / 2);
            const cx = mid.x - (rect.left + rect.width / 2);
            const cy = mid.y - (rect.top + rect.height / 2);
            const oldDisplay = Math.max(0.0001, fit * (st.touch.startScale || 1));
            const newDisplay = Math.max(0.0001, fit * nextScale);
            st.x = cx - ((startCx - (st.touch.startX || 0)) * newDisplay / oldDisplay);
            st.y = cy - ((startCy - (st.touch.startY || 0)) * newDisplay / oldDisplay);
          }else{
            st.x = (st.touch.startX || 0) + (mid.x - (st.touch.startMidX || mid.x));
            st.y = (st.touch.startY || 0) + (mid.y - (st.touch.startMidY || mid.y));
          }
          st.scale = nextScale;
          if(st.scale <= 1.001){ st.x = 0; st.y = 0; }
          applyViewerTransform();
        }else if(e.touches && e.touches.length === 1 && st.touch && st.touch.mode === 'pan'){
          if((st.scale || 1) <= 1.001) return;
          e.preventDefault();
          const t0 = e.touches[0];
          st.x = (st.touch.startX || 0) + (t0.clientX - st.touch.startClientX);
          st.y = (st.touch.startY || 0) + (t0.clientY - st.touch.startClientY);
          applyViewerTransform();
        }
      }, {passive:false});
      stage.addEventListener('touchend', function(e){
        const st = viewerState();
        if(e.touches && e.touches.length === 1){
          const t0 = e.touches[0];
          st.touch = {mode:'pan', startClientX:t0.clientX, startClientY:t0.clientY, startX:st.x || 0, startY:st.y || 0};
        }else{
          st.touch = null;
          $('#matchImageViewer').removeClass('touching');
        }
      }, {passive:false});
      stage.addEventListener('touchcancel', function(){
        const st = viewerState();
        st.touch = null;
        $('#matchImageViewer').removeClass('touching');
      }, {passive:false});
      stage.addEventListener('dblclick', function(e){
        e.preventDefault();
        const st = viewerState();
        if(st.scale > 1.001) resetViewerTransform();
        else zoomViewerTo(2, e.clientX, e.clientY);
      });
    }
    function deleteMatchImage(index){
      const match = currentPredictionMatch();
      if(!match) return;
      const matchKey = matchCloudKey(match);
      const img = (app.matchImages[matchKey] || [])[Number(index)];
      if(!img) return;
      if(!window.confirm(imageText('imageDeleteConfirm'))) return;
      loadCloudConfig(true).then(cfg => {
        if(!cfg || !isCloudConfigReady(cfg)) return;
        const id = encodeURIComponent(img.id || img.fileName || '');
        setMatchImageStatus(imageText('imageUploading'));
        $.ajax({
          url: cloudApi(`/api/matches/${encodeURIComponent(matchKey)}/images/${id}`),
          method: 'DELETE',
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          data: JSON.stringify({password: cfg.appPassword || ''}),
          timeout: 30000
        }).done(() => loadMatchImages(match, true))
          .fail(xhr => setMatchImageStatus(ajaxErrorMessage(xhr, imageText('imageUploadFail')), 'error'));
      });
    }


    function teamDetailText(key){
      const zh = {
        back:'返回', currentAll:'本届全部比赛', finishedMatches:'历史比赛 / 已结束比赛', worldCupHistory:'历届世界杯表现', noMatches:'暂无比赛数据', noFinished:'暂无已结束比赛', clickHint:'点击比赛可进入详情', fifa:'FIFA排名', power:'模型实力', record:'本届战绩', played:'场', win:'胜', draw:'平', loss:'负', goals:'进失球', points:'积分', upcoming:'未开赛', live:'进行中', finished:'已结束', notPlayed:'未参赛', year:'年份', result:'成绩'};
      const en = {
        back:'Back', currentAll:'All 2026 matches', finishedMatches:'History / finished matches', worldCupHistory:'World Cup history', noMatches:'No match data yet', noFinished:'No finished matches yet', clickHint:'Tap a match to open details', fifa:'FIFA rank', power:'Model power', record:'2026 record', played:'P', win:'W', draw:'D', loss:'L', goals:'GF-GA', points:'Pts', upcoming:'Upcoming', live:'Live', finished:'Finished', notPlayed:'Did not play', year:'Year', result:'Result'};
      const tr = {
        back:'Geri', currentAll:'2026 maçları', finishedMatches:'Geçmiş / biten maçlar', worldCupHistory:'Dünya Kupası geçmişi', noMatches:'Maç verisi yok', noFinished:'Biten maç yok', clickHint:'Detay için maça dokun', fifa:'FIFA sırası', power:'Model gücü', record:'2026 kaydı', played:'M', win:'G', draw:'B', loss:'M', goals:'A-Y', points:'Puan', upcoming:'Yaklaşan', live:'Canlı', finished:'Bitti', notPlayed:'Katılmadı', year:'Yıl', result:'Sonuç'};
      const dict = app.lang === 'zh' ? zh : (app.lang === 'tr' ? tr : en);
      return dict[key] || zh[key] || key;
    }
    function matchesForTeam(team){
      const n = normalizeTeam(team);
      return matchItems().filter(m => normalizeTeam(m.team1) === n || normalizeTeam(m.team2) === n)
        .slice().sort((a,b) => matchDate(a) - matchDate(b));
    }
    function teamMatchSideInfo(match, team){
      const n = normalizeTeam(team);
      const isLeft = normalizeTeam(match.team1) === n;
      return {
        isLeft,
        team: isLeft ? match.team1 : match.team2,
        opponent: isLeft ? match.team2 : match.team1
      };
    }
    function teamScoreBundle(match, team){
      const score = getScoreForMatch(match);
      const st = scoreStatusOf(matchDate(match), score);
      const sTeam = scoreForTeam(score, team);
      const side = teamMatchSideInfo(match, team);
      const sOpp = scoreForTeam(score, side.opponent);
      const has = st !== 'upcoming' && sTeam !== '' && sOpp !== '';
      return {score, st, sTeam, sOpp, has, side};
    }
    function teamRecordSummary(team){
      let played = 0, win = 0, draw = 0, loss = 0, gf = 0, ga = 0, pts = 0;
      matchesForTeam(team).forEach(m => {
        const b = teamScoreBundle(m, team);
        if(!b.has || b.st === 'upcoming') return;
        const a = Number(b.sTeam), o = Number(b.sOpp);
        if(Number.isNaN(a) || Number.isNaN(o)) return;
        played++; gf += a; ga += o;
        if(a > o){ win++; pts += 3; }
        else if(a === o){ draw++; pts += 1; }
        else loss++;
      });
      return {played, win, draw, loss, gf, ga, pts};
    }
    function teamHistoryRows(team){
      return WORLD_CUP_RANK_YEARS.map(year => {
        const rank = worldCupRankForYear(team, year);
        const text = rank == null
          ? teamDetailText('notPlayed')
          : (app.lang === 'zh' ? `第${rank}名` : `#${rank}`);
        return `<div class="team-history-row${rank == null ? ' empty' : ''}"><span>${esc(year)}</span><strong>${esc(text)}</strong></div>`;
      }).join('');
    }
    function teamStatusLabel(st, score){
      if(st === 'live') return teamDetailText('live');
      if(st === 'finished') return teamDetailText('finished');
      return teamDetailText('upcoming');
    }
    function teamMatchCardHtml(match, team){
      const b = teamScoreBundle(match, team);
      const mainTz = primaryTimeZone();
      const secondTz = secondaryTimeZone();
      const status = scoreDetailText(b.score, b.st) || teamStatusLabel(b.st, b.score);
      const scoreText = b.has ? `${b.sTeam} - ${b.sOpp}` : fmtTime(matchDate(match), mainTz);
      const opponent = b.side.opponent;
      const scoreClass = b.has ? 'has-score' : 'time-score';
      const dateText = `${fmtDateTime(matchDate(match), mainTz)} · ${timeZoneLabel(secondTz)} ${fmtDateTime(matchDate(match), secondTz)}`;
      const meta = `${stageLabel(match.round)}${match.group ? ' ' + groupLabel(match.group) : ''} · ${groundName(match.ground)}${groundCountryName(match.ground) ? ' · ' + groundCountryName(match.ground) : ''}`;
      return `<article class="team-detail-match-card" data-match-idx="${esc(match._idx)}" role="button" tabindex="0">
        <div class="team-detail-match-top"><span>${esc(dateText)}</span><em class="${esc(b.st)}">${esc(status)}</em></div>
        <div class="team-detail-match-main">
          <div class="team-detail-match-side self"><span class="flag-wrap">${flagImgHtml(b.side.team)}</span><strong>${esc(teamName(b.side.team))}</strong></div>
          <div class="team-detail-match-score ${scoreClass}">${esc(scoreText)}</div>
          <div class="team-detail-match-side"><span class="flag-wrap">${flagImgHtml(opponent)}</span><strong>${esc(teamName(opponent))}</strong></div>
        </div>
        <div class="team-detail-match-meta">${esc(meta)}</div>
      </article>`;
    }
    function renderTeamDetailPage(team){
      const list = matchesForTeam(team);
      const finished = list.filter(m => teamScoreBundle(m, team).st === 'finished');
      const rec = teamRecordSummary(team);
      const rank = fifaWorldRank(team);
      const flag = flagUrl(team);
      const allHtml = list.length ? list.map(m => teamMatchCardHtml(m, team)).join('') : `<div class="team-detail-empty">${esc(teamDetailText('noMatches'))}</div>`;
      const finishedHtml = finished.length ? finished.map(m => teamMatchCardHtml(m, team)).join('') : `<div class="team-detail-empty">${esc(teamDetailText('noFinished'))}</div>`;
      $('#teamPageHero').html(`<div class="team-detail-hero-bg"></div>
        <div class="team-detail-nav"><button class="team-detail-back" id="teamPageBackBtn" type="button">‹</button><div class="team-detail-nav-title">${esc(teamName(team))}</div></div>
        <div class="team-detail-main-head">
          <div class="team-detail-flag">${flag ? `<img src="${esc(flag)}" alt="${esc(teamName(team))}">` : placeholderFlag(team)}</div>
          <div class="team-detail-title-block"><h2>${esc(teamName(team))}</h2><p>${esc(fifaWorldRankText(team))}</p></div>
        </div>
        <div class="team-detail-stats">
          <div><span>${esc(teamDetailText('record'))}</span><strong>${rec.win}-${rec.draw}-${rec.loss}</strong></div>
          <div><span>${esc(teamDetailText('points'))}</span><strong>${rec.pts}</strong></div>
          <div><span>${esc(teamDetailText('goals'))}</span><strong>${rec.gf}-${rec.ga}</strong></div>
          <div><span>${esc(teamDetailText('power'))}</span><strong>${Math.round(teamPower(team))}</strong></div>
        </div>`);
      $('#teamPageContent').html(`<section class="team-detail-card team-detail-tip">${esc(teamDetailText('clickHint'))}</section>
        <section class="team-detail-card"><div class="team-detail-section-title"><h3>${esc(teamDetailText('currentAll'))}</h3><span>${list.length}</span></div><div class="team-detail-match-list">${allHtml}</div></section>
        <section class="team-detail-card"><div class="team-detail-section-title"><h3>${esc(teamDetailText('finishedMatches'))}</h3><span>${finished.length}</span></div><div class="team-detail-match-list">${finishedHtml}</div></section>
        <section class="team-detail-card"><div class="team-detail-section-title"><h3>${esc(teamDetailText('worldCupHistory'))}</h3><span>${esc(teamDetailText('fifa'))}${rank ? ' #' + esc(rank) : ''}</span></div><div class="team-history-grid">${teamHistoryRows(team)}</div></section>`);
    }
    function openTeamPage(team){
      if(!team) return;
      app.teamDetailTeam = team;
      renderTeamDetailPage(team);
      $('#teamPage').removeClass('hidden');
    }
    function closeTeamPage(){
      $('#teamPage').addClass('hidden');
      app.teamDetailTeam = null;
    }
    function renderPredictionPage(){
      const idx = Number(app.predictionIndex);
      const raw = matchItems()[idx] || app.matches[idx];
      if(!raw) return;
      const match = raw._date instanceof Date ? raw : createMatchItem(raw, idx);
      let model = predictionModel(match);
      model = freezePredictionModel(match, model);
      const score = getScoreForMatch(match);
      const st = scoreStatusOf(match._date, score);
      const statusLabel = st === 'finished' ? t('finished') : scoreDetailText(score, st);
      const mainTz = primaryTimeZone(), secondTz = secondaryTimeZone();
      let s1 = scoreForTeam(score, match.team1);
      let s2 = scoreForTeam(score, match.team2);
      if(score && (s1 === '' || s2 === '') && score.homeScore !== '' && score.awayScore !== ''){
        const t1 = normalizeTeam(match.team1);
        const t2 = normalizeTeam(match.team2);
        if(t1 === score.home && t2 === score.away){
          s1 = score.homeScore;
          s2 = score.awayScore;
        }else if(t1 === score.away && t2 === score.home){
          s1 = score.awayScore;
          s2 = score.homeScore;
        }
      }
      const hasActualScore = (st === 'live' || st === 'finished') && s1 !== '' && s2 !== '';
      const heroBadge = hasActualScore ? pt('actualScore') : pt('predictMatch');
      const heroMain = hasActualScore ? `${s1}-${s2}` : fmtTime(match._date, mainTz);
      const f1 = flagUrl(match.team1), f2 = flagUrl(match.team2);
      const stage = `${stageLabel(match.round)}${match.group ? ' ' + groupLabel(match.group) : ''}`;
      $('#predictionHeaderTitle').text(`${stage}`);
      if(app.predictionTab !== 'live') app.predictionTab = 'preview';
      $('#predictionPreviewTab').text(pt('previewTab')).toggleClass('active', app.predictionTab !== 'live');
      $('#predictionLiveTab').text(pt('liveTab')).toggleClass('active', app.predictionTab === 'live');
      $('#predictionHero').html(`
        <div class="prediction-top-teams">
          <button class="prediction-mini-team prediction-team-link" type="button" data-team="${esc(match.team1)}" aria-label="${esc(teamName(match.team1))}">
            <div class="flag-wrap">${f1 ? `<img src="${esc(f1)}" alt="${esc(teamName(match.team1))}">` : placeholderFlag(match.team1)}</div>
            <div>${esc(teamName(match.team1))}</div>
          </button>
          <div class="prediction-center">
            <div class="prediction-badge">${esc(heroBadge)}</div>
            <div class="prediction-kick">${esc(heroMain)}</div>
            <div class="prediction-status">${esc(timeZoneLabel(mainTz))}: ${esc(fmtTime(match._date, mainTz))} ｜ ${esc(timeZoneLabel(secondTz))}: ${esc(fmtDateTime(match._date, secondTz))}</div>
            <div class="prediction-status soft">${esc(statusLabel)}</div>
          </div>
          <button class="prediction-mini-team prediction-team-link" type="button" data-team="${esc(match.team2)}" aria-label="${esc(teamName(match.team2))}">
            <div class="flag-wrap">${f2 ? `<img src="${esc(f2)}" alt="${esc(teamName(match.team2))}">` : placeholderFlag(match.team2)}</div>
            <div>${esc(teamName(match.team2))}</div>
          </button>
        </div>
      `);
      if(app.predictionTab === 'live'){
        $('#predictionContent').html(renderMatchImagesShell(match));
        initMatchImages(match);
        return;
      }
      const factors = factorItems(match, model).map(x=>`<div class="factor-item"><div class="factor-key">${esc(x[0])}</div><div class="factor-val">${esc(x[1])}</div></div>`).join('');
      const normal = renderScorePickCards(model.normal, match, 'normal');
      const upset = renderScorePickCards(model.upset, match, 'upset');
      const favoriteLineupTeam = model.favSide === 'home' ? match.team1 : match.team2;
      const homeWidth = Math.max(8, model.p1);
      const drawWidth = Math.max(8, model.draw);
      const awayWidth = Math.max(8, model.p2);
      const conclusionTitle = favoredHeadline(teamName(model.fav));
      const conclusionSub = predictionIntro(match, model);
      const reasonChips = renderReasonChips(match, model);
      const flag1 = flagUrl(match.team1), flag2 = flagUrl(match.team2);
      const leftVenueText = homeBonus(match, match.team1) > homeBonus(match, match.team2)
        ? (app.lang === 'tr' ? 'Ev sahibi ve atmosfer avantajı' : (app.lang === 'en' ? 'Host / venue edge' : '赛地与主场氛围更占优'))
        : (app.lang === 'tr' ? 'Nötr saha etkisi' : (app.lang === 'en' ? 'More neutral venue context' : '场地优势相对中性'));
      const rightVenueText = homeBonus(match, match.team2) > homeBonus(match, match.team1)
        ? (app.lang === 'tr' ? 'Ev sahibi ve atmosfer avantajı' : (app.lang === 'en' ? 'Host / venue edge' : '赛地与主场氛围更占优'))
        : (app.lang === 'tr' ? '客队视角 ve yol etkisi' : (app.lang === 'en' ? 'Away-side travel context' : '客队视角，更多旅途因素'));
      const leftStrengthText = `${pt('modelScore')} ${Math.round(model.r1)}`;
      const rightStrengthText = `${pt('modelScore')} ${Math.round(model.r2)}`;
      $('#predictionContent').html(`
        <section class="prediction-card conclusion-card">
          <div class="conclusion-head">
            <div>
              <div class="conclusion-eyebrow">${esc(pt('aiConclusion'))}</div>
              <h3 class="conclusion-title">${esc(conclusionTitle)}</h3>
              <p class="conclusion-copy">${esc(conclusionSub)}</p>
            </div>
            <div class="conclusion-meter">
              <div class="big">${Math.max(model.p1, model.p2)}%</div>
              <div class="small">${esc(confidenceLabel(model))}</div>
            </div>
          </div>

          <div class="score-balance">
            <div class="score-balance-home" style="width:${homeWidth}%"></div>
            <div class="score-balance-draw" style="width:${drawWidth}%"></div>
            <div class="score-balance-away" style="width:${awayWidth}%"></div>
          </div>
          <div class="score-prob-pills">
            <div class="score-prob-pill"><i style="background:#ff5a87"></i>${esc(teamName(match.team1))} ${model.p1}%</div>
            <div class="score-prob-pill"><i style="background:#60d784"></i>${esc(pt('draw'))} ${model.draw}%</div>
            <div class="score-prob-pill"><i style="background:#4f73ff"></i>${esc(teamName(match.team2))} ${model.p2}%</div>
          </div>

          <div class="rank-duel">
            <div class="rank-duel-head">
              <div class="rank-team-box">
                <div class="rank-team-top">
                  ${flag1 ? `<img src="${esc(flag1)}" alt="${esc(teamName(match.team1))}">` : ''}
                  <div class="rank-team-name">${esc(teamName(match.team1))}</div>
                </div>
                <div class="rank-team-meta left">${esc(fifaWorldRankText(match.team1))}</div>
              </div>
              <div class="rank-team-box" style="text-align:right">
                <div class="rank-team-top" style="justify-content:flex-end">
                  <div class="rank-team-name">${esc(teamName(match.team2))}</div>
                  ${flag2 ? `<img src="${esc(flag2)}" alt="${esc(teamName(match.team2))}">` : ''}
                </div>
                <div class="rank-team-meta right">${esc(fifaWorldRankText(match.team2))}</div>
              </div>
            </div>
            <div class="rank-compare">
              <div class="rank-row">
                <div class="rank-side left rank-history-side">${worldCupRankHistoryInlineHtml(match.team1)}</div>
                <div class="rank-key rank-history-key">${esc(pt('rankLabel'))}</div>
                <div class="rank-side right rank-history-side">${worldCupRankHistoryInlineHtml(match.team2)}</div>
              </div>
              <div class="rank-row">
                <div class="rank-side left">${esc(leftStrengthText)}<span class="mini-rank">${esc(teamName(match.team1))}</span></div>
                <div class="rank-key">${esc(pt('strengthLabel'))}</div>
                <div class="rank-side right">${esc(rightStrengthText)}<span class="mini-rank">${esc(teamName(match.team2))}</span></div>
              </div>
              <div class="rank-row">
                <div class="rank-side left">${esc(leftVenueText)}</div>
                <div class="rank-key">${esc(pt('venueLabel'))}</div>
                <div class="rank-side right">${esc(rightVenueText)}</div>
              </div>
            </div>
          </div>

          <div class="decision-grid">
            <div class="decision-panel primary">
              <div class="decision-panel-head">
                <div class="decision-panel-title">${esc(pt('normalScores'))}</div>
                <div class="decision-panel-note">${esc(pt('topTwo'))}</div>
              </div>
              <div class="score-pick-grid score-pick-grid-normal">${normal}</div>
            </div>
            <div class="decision-panel hedge">
              <div class="decision-panel-head">
                <div class="decision-panel-title">${esc(pt('upsetScores'))}</div>
                <div class="decision-panel-note">${esc(pt('coldThree'))}</div>
              </div>
              <div class="score-pick-grid score-pick-grid-upset">${upset}</div>
            </div>
          </div>

          <div class="reason-strip">${reasonChips}</div>
        </section>

        <details class="prediction-more">
          <summary>${esc(pt('moreAnalysis'))}</summary>
          <div class="prediction-more-body">
            <div class="prediction-more-section">
              <h4>${esc(pt('coreFactors'))}</h4>
              <div class="factor-grid">${factors}</div>
            </div>
            <div class="prediction-more-section">
              <h4>${esc(pt('lineup'))}</h4>
              <p>${esc(teamName(favoriteLineupTeam))} · ${esc(pt('modelScore'))} ${model.favSide === 'home' ? Math.round(model.r1) : Math.round(model.r2)}</p>
              <div class="pitch-shell">${renderPitch(favoriteLineupTeam)}</div>
            </div>
            <div class="prediction-more-section">
              <h4>${esc(pt('tableTitle'))}</h4>
              <table class="mini-table">
                <thead><tr><th>${esc(pt('team'))}</th><th>${esc(pt('winRate'))}</th><th>${esc(pt('point'))}</th></tr></thead>
                <tbody>
                  <tr><td>${esc(teamName(match.team1))}</td><td>${model.p1}%</td><td>${Math.max(0,Math.round(model.r1-65))}</td></tr>
                  <tr><td>${esc(teamName(match.team2))}</td><td>${model.p2}%</td><td>${Math.max(0,Math.round(model.r2-65))}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>
        <section class="prediction-card">
          <p class="prediction-disclaimer">${esc(pt('disclaimer'))}</p>
        </section>
      `);
    }
    function openPredictionPage(idx){
      app.predictionIndex = Number(idx);
      app.predictionTab = "preview";
      renderPredictionPage();
      $('#predictionPage').removeClass('hidden');
    }
    function closePredictionPage(){
      closeTeamPage();
      $('#predictionPage').addClass('hidden');
      app.predictionIndex = null;
      renderLivePanel();
    }

    function loadData(force=false, silent=false, fetchScoreAfter=true){
      if(app.scheduleFetching) return $.Deferred().resolve().promise();
      if(force && !silent){
        app.lastContentHtml = '';
        $('#content').html(`<div class="loading"><div class="spinner"></div><div>${esc(t('loading'))}</div></div>`);
      }
      const cache = localStorage.getItem(CACHE_KEY);
      if(cache && !force){
        try{
          const data = JSON.parse(cache);
          applyLoadedMatches(data.matches || [], 'cache', true);
          if(fetchScoreAfter) refreshScoresOnce();
        }catch(e){}
      }
      app.scheduleFetching = true;
      return $.ajax({url:REMOTE_JSON, dataType:'json', timeout:10000, cache:false})
        .done(data=>{
          if(data && Array.isArray(data.matches)){
            localStorage.setItem(CACHE_KEY, JSON.stringify({updatedAt:new Date().toISOString(), matches:data.matches}));
            applyLoadedMatches(data.matches, 'remote', force && !silent);
            if(fetchScoreAfter) refreshScoresOnce();
          }
        })
        .fail(()=>{
          if(!app.matches.length && cache){
            try{
              const data = JSON.parse(cache);
              applyLoadedMatches(data.matches || [], 'cache', true);
              if(fetchScoreAfter) refreshScoresOnce();
            }catch(e){ render(); }
          } else if(!app.matches.length){
            render();
          }
        })
        .always(()=>{ app.scheduleFetching = false; });
    }

    function setupPwa(){
      if(isStandalone()) document.body.classList.add('standalone');

      // GitHub Pages 是 HTTPS，可以注册 Service Worker。
      // 只缓存页面外壳和图标；赛程和比分仍优先联网获取，成功后页面会写入 localStorage。
      if('serviceWorker' in navigator){
        window.addEventListener('load', function(){
          navigator.serviceWorker.register('./sw.js').catch(function(err){
            console.warn('Service worker registration failed:', err);
          });
        });
      }
    }

    function setupDateBarDesktopScroll(){
      const bar = document.getElementById('dateBar');
      if(!bar || bar.dataset.dragScrollReady === '1') return;
      bar.dataset.dragScrollReady = '1';

      let isDown = false;
      let startX = 0;
      let startScrollLeft = 0;
      let dragDistance = 0;
      let suppressNextClick = false;

      bar.addEventListener('mousedown', function(e){
        if(e.button !== 0) return;
        isDown = true;
        startX = e.pageX;
        startScrollLeft = bar.scrollLeft;
        dragDistance = 0;
        suppressNextClick = false;
        bar.classList.add('dragging');
      });

      window.addEventListener('mousemove', function(e){
        if(!isDown) return;
        const dx = e.pageX - startX;
        dragDistance = Math.max(dragDistance, Math.abs(dx));

        // 超过 8px 才认定为拖动；普通点击不会被拦截。
        if(dragDistance > 8){
          bar.scrollLeft = startScrollLeft - dx;
          suppressNextClick = true;
        }
      });

      window.addEventListener('mouseup', function(){
        if(!isDown) return;
        isDown = false;
        bar.classList.remove('dragging');
        setTimeout(()=>{ suppressNextClick = false; }, 120);
      });

      bar.addEventListener('click', function(e){
        // 只有真的横向拖动过，才阻止随后产生的误点击。
        if(suppressNextClick){
          e.preventDefault();
          e.stopPropagation();
          suppressNextClick = false;
        }
      }, true);

      bar.addEventListener('wheel', function(e){
        if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
          bar.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }, {passive:false});
    }


    function setupLivePanelHorizontalScroll(){
      if(window.__livePanelHorizontalScrollReady) return;
      window.__livePanelHorizontalScrollReady = true;

      let scroller = null;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let moved = false;

      function reset(){
        if(scroller) scroller.classList.remove('is-touch-dragging');
        scroller = null;
        moved = false;
      }

      document.addEventListener('touchstart', function(e){
        const target = e.target;
        const el = target && target.closest ? target.closest('.live-panel-list') : null;
        if(!el || !e.touches || !e.touches[0]) return;
        scroller = el;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startLeft = el.scrollLeft;
        moved = false;
      }, {passive:true});

      document.addEventListener('touchmove', function(e){
        if(!scroller || !e.touches || !e.touches[0]) return;
        const t0 = e.touches[0];
        const dx = t0.clientX - startX;
        const dy = t0.clientY - startY;
        if(Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.08){
          moved = true;
          scroller.classList.add('is-touch-dragging');
          scroller.scrollLeft = startLeft - dx;
          window.__livePanelSwipeSuppressUntil = Date.now() + 240;
          e.preventDefault();
          e.stopPropagation();
        }
      }, {passive:false});

      document.addEventListener('touchend', function(){
        if(moved) window.__livePanelSwipeSuppressUntil = Date.now() + 260;
        reset();
      }, {passive:true});
      document.addEventListener('touchcancel', reset, {passive:true});

      let mouseScroller = null;
      let mouseDown = false;
      let mouseStartX = 0;
      let mouseStartLeft = 0;
      let mouseMoved = false;

      document.addEventListener('mousedown', function(e){
        const target = e.target;
        const el = target && target.closest ? target.closest('.live-panel-list') : null;
        if(!el) return;
        mouseScroller = el;
        mouseDown = true;
        mouseMoved = false;
        mouseStartX = e.pageX;
        mouseStartLeft = el.scrollLeft;
        el.classList.add('is-mouse-dragging');
      });

      window.addEventListener('mousemove', function(e){
        if(!mouseDown || !mouseScroller) return;
        const dx = e.pageX - mouseStartX;
        if(Math.abs(dx) > 5){
          mouseMoved = true;
          mouseScroller.scrollLeft = mouseStartLeft - dx;
          window.__livePanelSwipeSuppressUntil = Date.now() + 180;
        }
      });

      window.addEventListener('mouseup', function(){
        if(mouseScroller) mouseScroller.classList.remove('is-mouse-dragging');
        if(mouseMoved) window.__livePanelSwipeSuppressUntil = Date.now() + 220;
        mouseScroller = null;
        mouseDown = false;
        mouseMoved = false;
      });

      document.addEventListener('wheel', function(e){
        const target = e.target;
        const el = target && target.closest ? target.closest('.live-panel-list') : null;
        if(!el) return;
        if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
          el.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }, {passive:false});
    }


    function setupFixedOuterScrollGuard(){
      if(window.__fixedOuterScrollGuardReady) return;
      window.__fixedOuterScrollGuardReady = true;

      let touchStartX = 0;
      let touchStartY = 0;

      document.addEventListener('touchstart', function(e){
        const t0 = e.touches && e.touches[0];
        if(!t0) return;
        touchStartX = t0.clientX;
        touchStartY = t0.clientY;
      }, {passive:true});

      document.addEventListener('touchmove', function(e){
        const target = e.target;
        const t0 = e.touches && e.touches[0];
        if(!t0 || !target) return;

        // 图片查看器打开时，由查看器自己处理手势，避免全局滚动保护拦截双指缩放/关闭按钮。
        if(target.closest && target.closest('#matchImageViewer')) return;

        // 国家详情页在预测页上层打开时，允许国家详情内容滚动。
        // 否则移动端全局滚动保护会把 team-page 的 touchmove 拦截掉，看起来像页面打不开/不能操作。
        if($('#teamPage').length && !$('#teamPage').hasClass('hidden')){
          if(target.closest && target.closest('.team-page-scroll')) return;
          if(target.closest && target.closest('.team-page')){
            e.preventDefault();
            return;
          }
        }

        // AI预测页打开时，只允许 AI 页面内容区域滚动。
        if($('#predictionPage').length && !$('#predictionPage').hasClass('hidden')){
          if(target.closest && target.closest('.prediction-scroll')) return;
          e.preventDefault();
          return;
        }

        // 赛程列表是唯一允许上下滚动的区域。
        if(target.closest && (target.closest('#content') || target.closest('#otherView'))){
          return;
        }

        // 日期栏只允许横向滑动，不允许上下拖动外层。
        if(target.closest && target.closest('.date-bar')){
          const dx = Math.abs(t0.clientX - touchStartX);
          const dy = Math.abs(t0.clientY - touchStartY);
          if(dx > dy) return;
        }

        e.preventDefault();
      }, {passive:false});
    }

    function bind(){
      function setLangMenuOpen(open){
        $('#langMenu').toggleClass('open', open);
        $('#langMenuBtn').attr('aria-expanded', open ? 'true' : 'false');
      }
      $('#langMenuBtn').on('click', function(e){
        e.stopPropagation();
        setLangMenuOpen(!$('#langMenu').hasClass('open'));
      });
      $('#langMenu').on('click', function(e){ e.stopPropagation(); });
      $('.lang-option').on('click', function(){
        const next = $(this).data('lang');
        if(!I18N[next]) return;
        app.lang = next;
        localStorage.setItem('wc2026_lang', app.lang);
        localStorage.setItem('wc2026_lang_manual', '1');
        setLangMenuOpen(false);
        applyLang();
        render();
      });
      function setMobileFilterOpen(open){
        $('#scheduleView').toggleClass('filter-open', open);
        $('#mobileMoreBtn').attr('aria-expanded', open ? 'true' : 'false');
      }
      $('#mobileMoreBtn').on('click', function(e){
        e.stopPropagation();
        setMobileFilterOpen(!$('#scheduleView').hasClass('filter-open'));
      });
      $('#mobileToolbar').on('click', function(e){ e.stopPropagation(); });
      $('#mobileFilterBackdrop').on('click', function(){ setMobileFilterOpen(false); });
      let filterTouchStartY = 0;
      let filterTouchStartX = 0;
      document.addEventListener('touchstart', function(e){
        if(!$('#scheduleView').hasClass('filter-open')) return;
        const t0 = e.touches && e.touches[0];
        if(!t0) return;
        filterTouchStartY = t0.clientY;
        filterTouchStartX = t0.clientX;
      }, {passive:true});
      document.addEventListener('touchmove', function(e){
        if(!$('#scheduleView').hasClass('filter-open')) return;
        const t0 = e.touches && e.touches[0];
        if(!t0) return;
        const dy = Math.abs(t0.clientY - filterTouchStartY);
        const dx = Math.abs(t0.clientX - filterTouchStartX);
        if(dy > 10 && dy > dx) setMobileFilterOpen(false);
      }, {passive:true});
      window.addEventListener('scroll', function(){
        if($('#scheduleView').hasClass('filter-open')) setMobileFilterOpen(false);
      }, {passive:true});
      $('#content').on('scroll', function(){
        if($('#scheduleView').hasClass('filter-open')) setMobileFilterOpen(false);
      });
      $(document).on('click', function(){
        if($('#scheduleView').hasClass('filter-open')) setMobileFilterOpen(false);
        setLangMenuOpen(false);
      });
      $(window).on('resize', function(){ setMobileFilterOpen(false); });
      function setAllDatesFromManualFilter(){
        app.todayOnly = false;
        $('#todayBtn').removeClass('active');
        app.activeDate = 'all';
        buildDateBar(app.matchItems);
      }
      $('#stageSelect,#teamSelect').on('focus pointerdown touchstart', function(){
        $(this).data('manual-filter-opened', true);
      });
      $('#stageSelect,#teamSelect').on('change', function(){
        // 手动筛选阶段或球队时，不管选择“全部”还是具体项，日期都切到“全部日期”。
        // 例如选择“土耳其”，不能继续停留在“今天”，否则会误显示没有比赛。
        setAllDatesFromManualFilter();
        render();
        refreshScoresOnce();
        $(this).data('manual-filter-opened', false);
      });
      $('#stageSelect,#teamSelect').on('blur', function(){
        // iOS 下拉框如果选择同一个值不会触发 change，这里兜底。
        if($(this).data('manual-filter-opened')){
          setAllDatesFromManualFilter();
          render();
          refreshScoresOnce();
        }
        $(this).data('manual-filter-opened', false);
      });
      $('#todayBtn').on('click', function(){
        app.todayOnly = !app.todayOnly;
        $(this).toggleClass('active', app.todayOnly);
        if(app.todayOnly) app.activeDate = todayDateKey();
        buildDateBar(app.matchItems);
        render();
        refreshScoresOnce();
        setMobileFilterOpen(false);
      });
      $('#allDatesBtn').on('click', function(){
        app.todayOnly = false;
        $('#todayBtn').removeClass('active');
        app.activeDate = 'all';
        buildDateBar(app.matchItems);
        render();
        refreshScoresOnce();
        setMobileFilterOpen(false);
      });
      $('#resetBtn').on('click', function(){
        $('#stageSelect').val('all');
        $('#teamSelect').val('all');
        applyTodayDefaultDate();
        buildDateBar(app.matchItems);
        render();
        refreshScoresOnce();
        setMobileFilterOpen(false);
      });
      $('#refreshBtn').on('click', ()=>{ loadData(true, false, true); setMobileFilterOpen(false); });
      $(document).on('click', '.date-chip', function(){
        app.todayOnly = false;
        $('#todayBtn').removeClass('active');
        app.activeDate = $(this).data('date');
        buildDateBar(app.matchItems);
        render();
        refreshScoresOnce();
        setMobileFilterOpen(false);
      });
      $(document).on('click', '.live-match-card', function(e){
        if(window.__livePanelSwipeSuppressUntil && Date.now() < window.__livePanelSwipeSuppressUntil){
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        const idx = $(this).data('match-idx');
        if(idx !== undefined && idx !== null && idx !== '') openPredictionPage(idx);
      });
      $(document).on('click', '.match-card', function(e){
        if($(e.target).closest('button,select,a').length) return;
        openPredictionPage($(this).data('match-idx'));
      });
      $(document).on('keydown', '.match-card', function(e){
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          openPredictionPage($(this).data('match-idx'));
        }
      });
      $(document).on('click', '.prediction-team-link', function(e){ e.preventDefault(); e.stopPropagation(); openTeamPage($(this).data('team')); });
      $(document).on('click', '#teamPageBackBtn', function(e){ e.preventDefault(); closeTeamPage(); });
      $(document).on('click', '.team-detail-match-card', function(e){ e.preventDefault(); const idx = $(this).data('match-idx'); closeTeamPage(); if(idx !== undefined && idx !== null && idx !== '') openPredictionPage(idx); });
      $(document).on('keydown', '.team-detail-match-card', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); const idx = $(this).data('match-idx'); closeTeamPage(); if(idx !== undefined && idx !== null && idx !== '') openPredictionPage(idx); } });
      $('#predictionBackBtn').on('click', closePredictionPage);
      $('#predictionPreviewTab').on('click', ()=>{ app.predictionTab = 'preview'; renderPredictionPage(); });
      $('#predictionLiveTab').on('click', ()=>{ app.predictionTab = 'live'; renderPredictionPage(); });
      $(document).on('click', '#predictionLiveRefreshBtn', function(e){ e.preventDefault(); refreshPredictionLiveData(); });
      $(document).on('click', '#matchImageUploadBtn', function(e){ e.preventDefault(); $('#matchImageFileInput').trigger('click'); });
      $(document).on('change', '#matchImageFileInput', function(){ uploadMatchImages(this.files); this.value = ''; });
      $(document).on('click', '#matchImageRefreshBtn', function(e){ e.preventDefault(); loadMatchImagesForCurrent(true); });
      $(document).on('click', '.match-image-thumb', function(e){ e.preventDefault(); const key = $('.match-images-card').data('match-key'); openImageViewer(String(key || ''), Number($(this).data('image-index')) || 0); });
      $(document).on('click', '.match-image-delete', function(e){ e.preventDefault(); e.stopPropagation(); deleteMatchImage($(this).data('image-index')); });
      $(document).on('click', '[data-viewer-action]', function(e){
        e.preventDefault();
        e.stopPropagation();
        const action = $(this).data('viewer-action');
        if(action === 'close') closeImageViewer();
        else if(action === 'prev') viewerMove(-1);
        else if(action === 'next') viewerMove(1);
        else if(action === 'zoomIn') viewerZoom(Math.max(0.25, (viewerState().scale || 1) * 0.2), e);
        else if(action === 'zoomOut') viewerZoom(-Math.max(0.25, (viewerState().scale || 1) * 0.2), e);
        else if(action === 'reset') resetViewerTransform();
      });
      $(document).on('touchend pointerup', '#matchImageViewerClose,.match-image-viewer-backdrop', function(e){
        e.preventDefault();
        e.stopPropagation();
        closeImageViewer();
      });
      $(document).on('keydown', function(e){
        if(e.key === 'Escape' && $('#matchImageViewer').length && !$('#matchImageViewer').hasClass('hidden')) closeImageViewer();
      });
      $(document).on('wheel', '#matchImageViewer .match-image-viewer-stage', function(e){
        e.preventDefault();
        const st = viewerState();
        const step = Math.max(0.25, (st.scale || 1) * 0.18);
        viewerZoom(e.originalEvent.deltaY < 0 ? step : -step, e);
      });
      $(window).on('resize orientationchange', function(){
        if($('#matchImageViewer').length && !$('#matchImageViewer').hasClass('hidden')) applyViewerTransform();
      });
      $('.tab').on('click', function(){ app.activeTab = $(this).data('tab'); $('.tab').removeClass('active'); $(this).addClass('active'); app.lastOtherHtml = ''; render(); refreshScoresOnce(); });
    }

    $(function(){

      $(document).on('click', '.live-panel-head, .live-collapse-btn', function(e){
        if($(e.target).closest('.live-match-card').length) return;
        e.preventDefault();
        e.stopPropagation();
        app.liveCollapsed = !app.liveCollapsed;
        renderLivePanel();
      });
      $(document).on('keydown', '.live-panel-head', function(e){
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          app.liveCollapsed = !app.liveCollapsed;
          renderLivePanel();
        }
      });

      setupPwa();
      setupFixedOuterScrollGuard();
      setupLivePanelHorizontalScroll();
      bind();
      loadScoreCache();
      applyLang();
      loadData(false);
      setupForegroundRefresh();
      startLiveScoreTimer();
    });
