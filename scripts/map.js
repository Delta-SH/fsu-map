var $container = null;
var $infwindow = null;

var delay = (function () {
    var timer = 0;
    return function (callback, ms) {
        clearTimeout(timer);
        timer = setTimeout(callback, ms);
    };
})();

var isNull = function(value) {
    return typeof value === "undefined" || value === null;
};

var isEmpty = function(value, whitespace) {
    return (whitespace || false) === true ? value.trim() : value === '';
};

var isNullOrEmpty = function(value, whitespace) {
    if (isNull(value) === true) return true;
    return isEmpty(value, whitespace);
};

String.prototype.startWith = function(value, ignoreCase) {
    if (value == null || value == "" || this.length == 0 || value.length > this.length) {
        return false;
    }

    ignoreCase = ignoreCase || false;
    if (ignoreCase === true) {
        return this.substr(0, value.length).toLowerCase() === value.toLowerCase();
    }

    return this.substr(0, value.length) === value;
};

String.prototype.endWith = function(value, ignoreCase) {
    if (value == null || value == "" || this.length == 0 || value.length > this.length) {
        return false;
    }

    ignoreCase = ignoreCase || false;
    if (ignoreCase === true) {
        return this.substr(this.length - value.length).toLowerCase() === value.toLowerCase();
    }

    return this.substr(this.length - value.length) === value;
};

String.format = function() {
    if (arguments.length == 0)
        return null;

    var str = arguments[0];
    for (var i = 1; i < arguments.length; i++) {
        var re = new RegExp('\\{' + (i - 1) + '\\}', 'gm');
        str = str.replace(re, arguments[i]);
    }

    return str;
};

var dictionary = function () {
    this.keys = new Array();
    this.data = new Array();

    this.put = function (key, value) {
        if (this.data[key] === null) {
            this.keys.push(value);
        }
        this.data[key] = value;
    };

    this.get = function (key) {
        return this.data[key];
    };

    this.remove = function (key) {
        this.keys.remove(key);
        this.data[key] = null;
    };

    this.isEmpty = function () {
        return this.keys.length === 0;
    };

    this.size = function () {
        return this.keys.length;
    };
};

var ellipsis = function (text, max) {
    if (text.length * 2 < max) { return text; }
    var temp1 = text.replace(/[^\x00-\xff]/g, '^^');
    var temp2 = temp1.substring(0, max);
    var hanzi_num = (temp2.split('\^').length - 1) / 2;
    max = max - hanzi_num;
    var res = text.substring(0, max);
    if (max < text.length) { return res + '...'; } else { return res; }
};

//验证地图是否有效
var valid = function(){
    return !(typeof BMap === "undefined");
};

//初始化地图
var init = function(){
    if(valid() === false)
        return false;

    //定义图标
    window.icon0 = new BMap.Icon("images/location0.png", new BMap.Size(32, 32));
    window.icon1 = new BMap.Icon("images/location1.gif", new BMap.Size(32, 32));
    window.icon2 = new BMap.Icon("images/location2.gif", new BMap.Size(32, 32));
    window.icon3 = new BMap.Icon("images/location3.gif", new BMap.Size(32, 32));
    window.icon4 = new BMap.Icon("images/location4.gif", new BMap.Size(32, 32));
    window.shadow = new BMap.Icon("images/shadow.png", new BMap.Size(32, 32));

    //地址解析器
    window.$geoc = new BMap.Geocoder();

    //初始化容器
    $container = new BMap.Map('container');
    $container.centerAndZoom('上海市', 11);

    //添加标准控件
    $container.addControl(new BMap.ScaleControl());
    $container.addControl(new BMap.MapTypeControl());
    $container.addControl(new BMap.NavigationControl({
        type: BMAP_NAVIGATION_CONTROL_ZOOM,
        anchor: BMAP_ANCHOR_BOTTOM_RIGHT
    }));

    //添加右键菜单
    var contextMenu = new BMap.ContextMenu();
    contextMenu.addItem(new BMap.MenuItem('当前坐标', function (point) { prompt('经度,纬度：', point.lng + "," + point.lat); }, { iconUrl: 'images/point.png' }));
    $container.addContextMenu(contextMenu);

    //启用全景地图
    var stCtrl = new BMap.PanoramaControl();
    stCtrl.setOffset(new BMap.Size(10, 60));
    $container.addControl(stCtrl);

    //启用滚轮缩放功能
    $container.enableScrollWheelZoom(true);

    //添加搜索功能
    window.$acCtrl = new BMap.Autocomplete({ 'input': 'searchbox-input', 'location': '上海市' });
    window.$acCtrl.addEventListener("onhighlight", function (e) {
        var str = "", value = "";
        var _value = e.fromitem.value;
        if (e.fromitem.index > -1) {
            value = _value.province + _value.city + _value.district + _value.street + _value.business;
        }
        str = "FromItem<br />index = " + e.fromitem.index + "<br />value = " + value;

        value = "";
        if (e.toitem.index > -1) {
            _value = e.toitem.value;
            value = _value.province + _value.city + _value.district + _value.street + _value.business;
        }
        str += "<br />ToItem<br />index = " + e.toitem.index + "<br />value = " + value;

        $("#search-results").html(str);
    });

    window.$acCtrl.addEventListener("onconfirm", function (e) {
        var _value = e.item.value;
        var text = _value.province + _value.city + _value.district + _value.street + _value.business;
        $("#search-results").html("onconfirm<br />index = " + e.item.index + "<br />value = " + text);
        searchMarkers(text);
    });

    //搜索按钮事件
    $('#search-button').on('click', function () {
        var text = $('#searchbox-input').val();
        if (text.length === 0) return;
        searchMarkers(text);
    });

    //根据IP定位
    (new BMap.LocalCity()).get(function (result) {
        var cityName = result.name;
        $container.centerAndZoom(cityName, 11);
        $acCtrl.setLocation(cityName);
    });

    //范围变化，重新请求标记
    $container.addEventListener("zoomend", function () {
        delay(requestMarkers, 500);
    });

    //范围变化，重新请求标记
    $container.addEventListener("dragend", function () {
        delay(requestMarkers, 500);
    });
};

//搜索标记
var searchMarkers = function (text) {
    if(valid() === false)
        return false;

    if(isNull($container) === true)
        return false;

    var local = new BMap.LocalSearch($container, {
        renderOptions: { map: $container }
    });

    $container.clearOverlays();
    local.search(text);
};

//请求标记
var requestMarkers = function () {
    if(valid() === false)
        return false;

    if(isNull($container) === true)
        return false;

    var bs = $container.getBounds();
    var bssw = bs.getSouthWest();
    var bsne = bs.getNorthEast();

    var cmd = String.format('cmd://getrangemarkers?{0}&{1}&{2}&{3}',bssw.lng,bsne.lng,bssw.lat,bsne.lat);
    window.location.href = cmd;
};

//添加标记
var addMarkers = function(data){
    if(valid() === false)
        return false;

    if(isNull($container) === true)
        return false;

    clearMarkers();

    window.$configs = data;
    var markers = [];
    for (var i = 0; i < data.length; i++) {
        markers.push(createMarker(data[i], new BMap.Point(data[i].Longitude, data[i].Latitude)));
    }

    if(markers.length > 0) {
        var zoom = $container.getZoom();
        doLabel(zoom, markers);

        for (var k = 0; k < markers.length; k++) {
            $container.addOverlay(markers[k]);
        }
    }
};

//生成标记
var createMarker = function (cfg, point) {
    if(valid() === false)
        return false;

    if(isNull($container) === true)
        return false;

    var marker = new BMap.Marker(point || new BMap.Point(cfg.Longitude, cfg.Latitude), { title: cfg.Name, enableMassClear: false });
    var label = new BMap.Label(cfg.Name, { offset: new BMap.Size(30, 3) });
    marker._cfg = cfg;

    if (cfg.State === 1) {
        label.setStyle({ background: '#f04b51', border: '#f04b51', 'border-radius': '3px', padding: '3px 5px', color: "#fff" });
        marker.setIcon(icon1);
        marker.setShadow(shadow);
        marker.setLabel(label);
    } else if (cfg.State === 2) {
        label.setStyle({ background: '#efa91f', border: '#efa91f', 'border-radius': '3px', padding: '3px 5px', color: "#fff" });
        marker.setIcon(icon2);
        marker.setShadow(shadow);
        marker.setLabel(label);
    } else if (cfg.State === 3) {
        label.setStyle({ background: '#f5d313', border: '#f5d313', 'border-radius': '3px', padding: '3px 5px', color: "#fff" });
        marker.setIcon(icon3);
        marker.setShadow(shadow);
        marker.setLabel(label);
    } else if (cfg.State === 4) {
        label.setStyle({ background: '#0892cd', border: '#0892cd', 'border-radius': '3px', padding: '3px 5px', color: "#fff" });
        marker.setIcon(icon4);
        marker.setShadow(shadow);
        marker.setLabel(label);
    } else {
        label.setStyle({ background: '#48ac2e', border: '#48ac2e', 'border-radius': '3px', padding: '3px 5px', color: "#fff" });
        marker.setIcon(icon0);
        marker.setShadow(shadow);
        marker.setLabel(label);
    }

    marker.addEventListener("click", clkMarker);
    marker.addEventListener("dblclick", dblMarker);
    return marker;
};

//更新标记
var doMarker = function (cfg) {
    if(valid() === false)
        return false;

    if(isNull($container) === true)
        return false;

    var markers = $container.getOverlays();
    for (var i = 0; i < markers.length; i++) {
        var marker = markers[i];
        if (!marker._cfg) continue;
        if(marker._cfg.ID != cfg.ID) continue;

        marker._cfg = cfg;
        var label = marker.getLabel();
        if (cfg.State === 1) {
            label.setStyle({ background: '#f04b51', border: '#f04b51', 'border-radius': '3px', padding: '3px 5px', color: "#fff" });
            marker.setIcon(icon1);
        } else if (cfg.State === 2) {
            label.setStyle({ background: '#efa91f', border: '#efa91f', 'border-radius': '3px', padding: '3px 5px', color: "#fff" });
            marker.setIcon(icon2);
        } else if (cfg.State === 3) {
            label.setStyle({ background: '#f5d313', border: '#f5d313', 'border-radius': '3px', padding: '3px 5px', color: "#fff" });
            marker.setIcon(icon3);
        } else if (cfg.State === 4) {
            label.setStyle({ background: '#0892cd', border: '#0892cd', 'border-radius': '3px', padding: '3px 5px', color: "#fff" });
            marker.setIcon(icon4);
        } else {
            label.setStyle({ background: '#48ac2e', border: '#48ac2e', 'border-radius': '3px', padding: '3px 5px', color: "#fff" });
            marker.setIcon(icon0);
        }
    }
};

//删除标记
var clearMarkers = function () {
    if(valid() === false)
        return false;

    if(isNull($container) === true)
        return false;

    var markers = $container.getOverlays();
    for (var i = 0; i < markers.length; i++) {
        var marker = markers[i];
        if (!marker._cfg) continue;
        $container.removeOverlay(marker);
    }
};

//点击标记
var clkMarker = function (e) {
    var cfg = e.target._cfg;
    if(isNull($infwindow) === false 
        && $infwindow._isOpen === true
        && isNull($infwindow._marker) === false
        && $infwindow._marker._cfg.ID === cfg.ID)
    return false;

    initWindow();
    $infwindow.open(e.target);
    $infwindow.setTitle(cfg.Name + '&nbsp;&nbsp;<a href=\"cmd://markercallback?'+cfg.ID+'\" target=\"_self\">详情»</a>');
    $infwindow.setContent(getContent(cfg));
    $infwindow._address = null;

    if(cfg.DisplayAddress === true){
        $geoc.getLocation(e.target.getPosition(), function (rs) {
            var address = rs.addressComponents;
            var detail = address.province + address.city + address.district + address.street + address.streetNumber;
            $(".contentWndBox > .baseinfo > .content > .item-address > .item-text")
            .html(detail).attr({ title: detail });
            $infwindow._address = detail;
        });
    }
};

//双击标记
var dblMarker = function(e) {
    if(valid() === false)
        return false;

    if(isNull($container) === true)
        return false;

    var cfg = e.target._cfg;
    if(isNull(cfg) === true 
       && isNull($infwindow) === false 
       && isNull($infwindow._marker) === false){
        cfg = $infwindow._marker._cfg;
    }

    var cmd = String.format('cmd://markercallback?{0}',cfg.ID);
    window.location.href = cmd;
};

//根据范围大小决定是否显示标签
var doLabel = function (zoom, markers) {
    if(valid() === false)
        return false;

    if(isNull($container) === true)
        return false;

    for (var i = 0; i < markers.length; i++) {
        var marker = markers[i];
        if (!marker._cfg) continue;

        if (zoom < 11)
            marker.getLabel().hide();
        else
            marker.getLabel().show();
    }
};

//初始化详细信息窗体
var initWindow = function(){
    if(valid() === false)
        return false;

    if(isNull($container) === true)
        return false;

    if (isNull($infwindow) === true) {
        $infwindow = new BMapLib.SearchInfoWindow($container, '', {
            title: '',      //标题
            width: 300,             //宽度
            height: 0,              //高度
            panel: "panel",         //检索结果面板
            enableAutoPan: true,     //自动平移
            searchTypes: [
                // BMAPLIB_TAB_SEARCH,   //周边检索
                // BMAPLIB_TAB_TO_HERE,  //到这里去
                // BMAPLIB_TAB_FROM_HERE //从这里出发
            ]
        });
    }

    if ($infwindow._isOpen === true)
        $infwindow.close();
};

//更新详细信息窗体
var doWindow = function(data){
    if (isNull($infwindow) === true) {
        return false;
    }

    if ($infwindow._isOpen === false) {
        return false;
    }

    if (isNull($infwindow._marker) === true) {
        return false;
    }

    if ($infwindow._marker._cfg.ID !== data.ID) {
        return false;
    }

    var offset = $('.contentWndBox .datatable > .databody').scrollTop();
    $infwindow.setContent(getContent(data, $infwindow._address));
    $infwindow._marker._cfg = data;
    $('.contentWndBox .datatable > .databody').scrollTop(offset);
};

//获取详细信息窗体内容
var getContent = function (cfg, address) {
    if(isNull(cfg) === true)
        return "";

    var html = '<div class="contentWndBox">';
    //基础信息
    html += '<div class="section baseinfo">';
    html += '<div class="title">基础信息</div>';
    html += '<div class="content">';
    html += '<div class="item">';
    html += '<div class="item-label">名称：</div>';
    html += '<div class="item-text">'+cfg.Name+'</div>';
    html += '</div>';
    if(isNull(cfg.Type) === false){
        html += '<div class="item">';
        html += '<div class="item-label">类型：</div>';
        html += '<div class="item-text">'+cfg.Type+'</div>';
        html += '</div>';
    }
    if(cfg.DisplayAddress === true){
        html += '<div class="item item-address">';
        html += '<div class="item-label">地址：</div>';
        html += '<div class="item-text">'+(address||'')+'</div>';
        html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    //告警统计信息
    if(isNull(cfg.AlarmCounter) === false){
        html += '<div class="section alarm">';
        html += '<div class="title">告警统计</div>';
        html += '<div class="content">';
        html += '<div class="item">';
        html += '<div class="item-span">一级告警： '+cfg.AlarmCounter.Level1+'条</div>';
        html += '<div class="item-span">二级告警： '+cfg.AlarmCounter.Level2+'条</div>';
        html += '</div>';
        html += '<div class="item">';
        html += '<div class="item-span">三级告警： '+cfg.AlarmCounter.Level3+'条</div>';
        html += '<div class="item-span">四级告警： '+cfg.AlarmCounter.Level4+'条</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
    }

    //重要信号
    if(isNull(cfg.SigDatas) === false && cfg.SigDatas.length > 0){
        html += '<div class="section signal">';
        html += '<div class="title">重要信号</div>';
        html += '<div class="datatable">';
        html += '<div class="datahead">';
        html += '<table cellspacing="0" cellpadding="0" span width="100%">';
        html += '<thead>';
        html += '<tr>';
        html += '<th style="width: 120px;">信号名称</th>';
        html += '<th style="width: 80px;">信号测值</th>';
        html += '<th>测值描述</th>';
        html += '</tr>';
        html += '</thead>';
        html += '</table>';
        html += '</div>';
        html += '<div class="databody">';
        html += '<table cellspacing="0" cellpadding="0" width="100%">';
        html += '<thead>';
        html += '<tr>';
        html += '<th style="width: 120px;">';
        html += '<div>信号名称</div>';
        html += '</th>';
        html += '<th style="width: 80px;">';
        html += '<div>信号测值</div>';
        html += '</th>';
        html += '<th>';
        html += '<div>测值描述</div>';
        html += '</th>';
        html += '</tr>';
        html += '</thead>';
        html += '<tbody>';
        $.each(cfg.SigDatas, function(index,val){
             html += '<tr class="'+(index%2 === 0 ? 'odd' : 'even')+'">';
             html += '<td>'+val.Name+'</td>';
             html += '<td class="'+getState(val.State)+'">'+val.Value+'</td>';
             html += '<td>'+val.Desc+'</td>';
             html += '</tr>';
        });
        html += '</tbody>';
        html += '</table>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
    }

    html += '</div>'
    return html;
};

//获取信号状态样式
var getState = function(state){
    switch(state){
        case 0:
        return 'state0';
        case 1:
        return 'state1';
        case 2:
        return 'state2';
        case 3:
        return 'state3';
        case 4:
        return 'state4';
        case 5:
        return 'state5';
        case 6:
        return 'state6';
        case 7:
        return 'state7';
        default:
        return 'state0';
    }
};

//模拟请求
var testRequest = function(){
    $.getJSON("scripts/data.json", function (data) {
        getrangemarkers(JSON.stringify(data));
    });
}

//模拟更新
var testUpdate = function(){
    $.getJSON("scripts/update.json", function (data) {
        updatemarker(JSON.stringify(data));
    });
}

//接口方法
var getrangemarkers = function(data){
    if (isNullOrEmpty(data) === false) {
        if (data.startWith('Error') === false) {
            var cfg = JSON.parse(data);
            addMarkers(cfg);
        } else {
            alert(data);
        }
    }
};

var updatemarker = function(data){
    if (isNullOrEmpty(data) === true) {
        return false
    }

    if (data.startWith('Error') === true) {
        return false
    }

    var cfg = JSON.parse(data);
    doMarker(cfg);
    doWindow(cfg);
};

//页面加载完成
$(document).ready(function () {
    if (valid() === false) {
        $('body').css({ height: 'auto' });
        $('#container').hide();
        $('#search-panel').hide();
        $('#unconnected-panel').show();
        return false;
    }

    init();
});