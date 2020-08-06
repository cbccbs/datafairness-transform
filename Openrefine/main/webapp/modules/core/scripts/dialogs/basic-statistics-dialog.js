// for window resize event.
var _BasicStatisticsDialogUI = null;

function BasicStatisticsDialogUI(headerOriginalNameIndex) {
	this._createDialog(headerOriginalNameIndex);
} 

BasicStatisticsDialogUI.prototype._createDialog = function(selectedHeaders) {
	_BasicStatisticsDialogUI = this;
	
	var self = this;
	this.statData = {};

	var frame = $(DOM.loadHTML("core", "scripts/dialogs/basic-statistics-dialog.html"));
	this._elmts = DOM.bind(frame);

	this._level = DialogSystem.showDialog(frame);
	
	// btn setting
	this._elmts.closeButton.html($.i18n('core-buttons/close'));
	this._elmts.closeButton.click(function() {
		self._dismiss();
		Refine.OpenProjectUI.prototype._addTagFilter()
	});

	//set browser resize event
	$(window).resize((target) => {
		if (_BasicStatisticsDialogUI != null) {
			_BasicStatisticsDialogUI._setDialog();
		}
	})

	// title setting
	var title = $('<h5>').text($.i18n('core-index-dialog/title'));
	$('#graph-title').append(title);
	
	// Create Dialog
	this._getStatisticData(selectedHeaders);
}

BasicStatisticsDialogUI.prototype._getStatisticData = function(selectedHeaders) {
	if (selectedHeaders == 'all') {
		selectedHeaders = [];
	}
	var _self = this;
	
	const warningDialog = DialogSystem.showBusy()
	
	$.post(
			"command/core/get-based-statistic?" + $.param({ project: UI_CHART_INFO.selectedPId}),
			{headers: selectedHeaders.join(',')},	// no history option
			function(data) {
				warningDialog();
				
				if(data.code === "error") {
					alert('error')
				} else {
					_self.statData = data;
					_self._setDialog('all');
				}
			},
			"json"
	);
}
BasicStatisticsDialogUI.prototype._setDialog = function(drawType) {
	const warningDialog = DialogSystem.showBusy()
	
	// browser resized or normal
	this._createChart_default(this.statData.columnInfo);
	this._createChart_d3(this.statData.columnInfo, this.statData.frequencyList);
	if (drawType == 'all') {
		this._createGrid(this.statData.columnInfo, this.statData.rowNames);
	}
	
	warningDialog();
}
BasicStatisticsDialogUI.prototype._dataConvert = function(type, datas) {
	var returnArray = [];
	if (type == 'int') {
		datas.forEach( (d) => {
			returnArray.push(d*1)
		});
	} 
	return returnArray;
}
BasicStatisticsDialogUI.prototype._createChart_default = function(columnInfo) {
	const dialog = $('.dialog-body');
	const minTdWidth = 120;
	const _cnt = columnInfo.length;
	
	const bodyWidth = dialog.width();
	if (bodyWidth < (_cnt * minTdWidth)) {
		dialog.css('overflow-x', 'scroll');
	}
	
	var dialogChart = this._elmts.basic_statistics_chart.empty();
	
	var template = '';
	template += '<table>';
	template += '<tr>';
	
	template += '<th>';
	template += '</th>';
	
	columnInfo.forEach( (c,i)=> {
		var divId = '';
		divId = 'chart_template_'+i;
		template += '<td>';
		template += '<div id="'+divId+'" class="statistic_chart_warp">';
		template += '<div id="tooltip_'+divId+'" class="chart_tooltip">';
		template += '</div>';
		template += '</div>';
		template += '</td>';
	})
	
	template += '</tr>';
	template += '</table>';
	dialogChart.append(template);
}

BasicStatisticsDialogUI.prototype._getD3ChartSeries = function(data) {
	const keys = Object.keys(data);
	const values = Object.values(data);
	
	var data = []
	
	keys.forEach( (_k, i)=> {
		data.push({
			key : _k,
			value : values[i]
		})
	})
	return data
}

// d3.js
BasicStatisticsDialogUI.prototype._createChart_d3 = function(columnInfo, datas) {
	const _self = this
	
	const td = $('#chart_template_'+0)
	const width = td.width();
	const height = td.height();
	const margin = {top: 10, right: 10, bottom: 10, left: 40}
	
	const extent = [[margin.left, margin.top], [width - margin.right, height - margin.top]];

	for (var i = 0, size = columnInfo.length; i < size; i++) {
		const c = columnInfo[i];
		
		const svg = d3.select('#chart_template_'+i)
		.append('svg')
		.style('width', width)
		.style('height', height);
		
		if (columnInfo.type != 'string') {
			const data = this._getD3ChartSeries(datas[i]);
			var fillColor = 'royalblue';
			

			// zoom 설정
			function zoomed() {
				x.range([margin.left, width - margin.right].map(d => d3.event.transform.applyX(d)));
				svg.selectAll(".bars rect").attr("x", d => x(d.key)).attr("width", x.bandwidth());
				svg.selectAll(".x-axis").call(xAxis);
			}
			
			svg.call(d3.zoom()
//					.scaleExtent([1, 32])	// use default value (1 to Infinity) 
					.translateExtent(extent)
					.extent(extent)
					.on("zoom", zoomed));
			
			const x = d3.scaleBand()
				.domain(data.map(d => d.key))
				.range([margin.left, width - margin.right])
				.padding(0.4);
			 
			const y = d3.scaleLinear()
				.domain([0, d3.max(data, d => d.value)]).nice()
				.range([height - margin.bottom, margin.top]);
			 
			const xAxis = g => g
				.attr('transform', `translate(0, ${height - margin.bottom})`)
				.call(d3.axisBottom(x).tickSizeOuter(0))
				.call(g => g.select('.domain').remove())
				.call(g => g.selectAll('line').remove())
				.selectAll('text')
				.style('display', 'none');
			 
			// line chart와 동일
			const yAxis = g => g
				.attr('transform', `translate(${margin.left}, 0)`)
				.call(d3.axisLeft(y))
				.call(g => g.select('.domain').remove())
				.call(g => g.selectAll('line')
						.attr('x2', width)
						.style('stroke', '#f5f5f5'))
						
			svg.append('g').call(xAxis);
			svg.append('g').call(yAxis);
			
			svg.append('g')
		      	.attr("class", "bars")
				.selectAll('rect').data(data).enter().append('rect')
				.attr('x', d => x(d.key))
				.attr('y', d => y(d.value))
				.attr('height', d => y(0) - y(d.value))
				.attr('width', x.bandwidth())
				.attr('fill', fillColor)
				.attr('data-x', d => d.key)
				.attr('data-y', d => d.value);
			 
			const rectEl = document.getElementById('chart_template_'+i).getElementsByTagName('rect');
			for(const el of rectEl) {
				// event reset
				el.removeEventListener('mouseover', ()=>{})
				el.addEventListener('mouseover', (event) => {
					const target = event.target;
					const tooltip = target.parentElement.parentElement.previousElementSibling;
					
					const tQuery = $(tooltip);
					tQuery.css('visibility', 'visible')
					const positionLeft = Number(target.getAttribute('x')) + Number(x.bandwidth()/2) - tooltip.clientWidth/2;
					const positionTop = height - margin.top - target.getAttribute('height') - tooltip.clientHeight + 10;
					const color = target.dataset.color;
					const value = target.dataset.y;
					const key = target.dataset.x;
					
					tQuery.empty();
					var tQueryTemplate = '';
					
					tQueryTemplate += '<div class="tooltip_text">';
					tQueryTemplate += '<p>key : ' + key + '</p>';
					tQueryTemplate += '<p>count : ' + value + '</p>';
					tQueryTemplate += '</div>';
					
					tQuery.append(tQueryTemplate)
					tooltip.style.top = positionTop + 'px';
					tooltip.style.left = positionLeft + 'px';
					tooltip.style.opacity = 1;
				});
				el.addEventListener('mouseout', (event) => {
					const target = event.target;
					const tooltip = target.parentElement.parentElement.previousElementSibling;
					
					$(tooltip).css('visibility', 'hidden')
				});
			}
		}
	};
}
	
BasicStatisticsDialogUI.prototype._createGrid = function(column, rowNames) {
	// reset grid panel 
	var dialogChart = this._elmts.basic_statistics_grid.empty();
	
	// template 생성
	var template = '';
	template += '<table>';
	
	rowNames.forEach((r, rI)=>{
		template += '<tr>';
		
		template += '<th>';
		template += '<span>'+r.key+'</span>';
		template += '</th>';
		
		for ( var i = 0; i < column.length; i++) {
			const c = column[i];
			
			template += '<td>';
			
			var val = c[r.key];
			if (val == undefined || val == ''){
				val = 0;
			}
			
			template += '<span>'+val+'</span>';
			template += '</td>';
		}
		template += '</tr>';
	})
	template += '</table>';
	dialogChart.append(template);	
}

// when close Dialog 
BasicStatisticsDialogUI.prototype._dismiss = function() {
	_BasicStatisticsDialogUI = null;
	this.statData = {};
	
	DialogSystem.dismissUntil(this._level - 1);
};
