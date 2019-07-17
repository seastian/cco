let dispatch = d3.dispatch("load","update","filter");

let test;

let test1;

d3.json("https://api.github.com/repos/seastian/cco/contents/data.json").then(function(data){
    data = JSON.parse(atob(data.content));
    let timeParser = d3.timeParse("%d/%m/%Y %H:%M");
    data.lastUpdate = timeParser(data.lastUpdate);
    data.vuelos.forEach((d) => {
        let delayTrigger = 15; // 15 min
        d.et = timeParser(d.et);
        d.st = timeParser(d.st);
        d.at = timeParser(d.at);
        d.delta = (() => {
            if(d.remark === "CON" || d.remark === "CAN" || d.remark === "DES" || d.remark === "ALT" || d.remark === "REP") {
                return null;
            } else if(d.at) {
                if(Math.abs(d.at - d.st) > 15*60*1000)
                    return Math.sign(d.at - d.st)*(Math.abs(d.at - d.st)/1000/60 - delayTrigger);
                else return null
            } else if((data.lastUpdate - d.st) > delayTrigger*60*1000) { // hace 15 min que no llego
                return Math.round((data.lastUpdate - d.st)/1000/60 - delayTrigger);
            } else if(d.et) { // mayor a 15 min
                if(Math.abs(d.et - d.st) > delayTrigger*60*1000) {
                    return Math.sign(d.et - d.st)*(Math.abs(d.et - d.st)/1000/60 - delayTrigger)
                } else {
                    return null;
                }
            } else {
                return null;
            }
        })();
    });
    data.vuelos = data.vuelos.filter(d => d.aerolinea !== "PRV" && Math.abs(d.st - data.lastUpdate) < 12*60*60*1000);
    data.filters = {};
    data.dimFilter = function(dimension) {
        return this.vuelos.filter(vuelo => {
            for(let j in this.filters) {
                if (j === dimension) continue;
                if(!(this.filters[j](vuelo))) return false;
            }
            return true;
        })
    };
    test = data
    dispatch.call("update",null,data)
    dispatch.call("filter",null,data);
})

dispatch.on("update.lastupdate", function(data) {
    d3.select(".lastupdate").text(data.lastUpdate)
});

dispatch.on("load.aerolineas", function() {
    let dimension = "aerolineas";
    let container = d3.select(".grafico-aerolineas");

    dispatch.on("update.aerolineas filter.aerolineas", function(data) {
        d3.select(".aerolineas .reset-btn")
        .on("click", function() {
            delete data.filters[dimension]
            dispatch.call("filter",null,data)
        })
        let filteredData = data.dimFilter(dimension);
        let nest = d3.nest().key(d => d.aerolinea).sortKeys(d3.ascending).entries(filteredData);

        let divs = container.selectAll("div")
            .data(nest, d => d.key)

        divs.enter()
            .append("div")
            .merge(divs)
            .attr("class", d => {
                if (data.filters[dimension]) {
                    return data.filters[dimension]({aerolinea: d.key}) ? "selected" : "not-selected";
                } else {
                    return "selected";
                }
            })
            .text(d => d.key)
            .on("click", function(d) {
                data.filters[dimension] = (vuelo) => vuelo.aerolinea === d.key
                dispatch.call("filter", this, data)
            })

        divs.exit()
            .transition()
            .duration(2000)
            .style("opacity",0)
            .remove();

    });
});

dispatch.on("load.histograma", function() {
    let dimension = "st";

    let margin = {top: 20, bottom: 70, right: 20, left: 32},
        width = 700 - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;

    let svg = d3.select(".histograma")
        .append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
            .attr("transform",`translate(${margin.left},${margin.top})`)

    let xScale = d3.scaleTime()
            .range([0, width])
            
    let brush = svg.append("g")
        .attr("class","brush")
   
    let xAxis = svg.append("g")
        .attr("transform",`translate(0,${height})`)
        .classed("xAxis",true);

    let yScale = d3.scaleLinear()
        .domain([0, 22])
        .range([height, 0]);
    
    svg.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .attr("font-size",14)
    
    function drawHistograma(data) {
        let filteredData = data.dimFilter(dimension)
        nest = d3.nest()
            .key(d => d3.timeHour(d.st).getTime())
            .key(d => d.tipo)
            .entries(filteredData);
        
        let g = svg.selectAll("g.horas")
            .data(nest,d => d.key)

        g.exit().selectAll("rect")
            .transition()
            .duration(2000)
            .attr("y",height)
            .attr("height",0)

        let rects = g.enter()
            .append("g")
            .classed("horas",true)
            .attr("transform",(d) => `translate(${xScale(Number(d.key))},0)`)
            .merge(g)
            .attr("opacity", d => {
                if (data.filters[dimension]) {
                    return data.filters[dimension]({st: d.key}) ? "1" : "0.5";
                } else {
                    return "1";
                }
            })
            .selectAll("rect")
            .data(d => d.values, d => d.key )
        
        rects.exit()
            .transition()
            .duration(2000)
            .attr("y",height)
            .attr("height",0)

        rects.enter()
                .append("rect")
                .attr("x",d => d.key === "arribo" ? 2 : 11)
                .attr("width",9)
                .attr("fill",d => d.key === "arribo" ? "yellow" : "steelblue")
                .attr("y",height)
                .attr("height",0)   
                .merge(rects)
                .transition()
                .duration(2000)
                .attr("y",(d) => yScale(d.values.length))
                .attr("height", (d) => height - yScale(d.values.length))
    }
    dispatch.on("update.histograma", function(data) {
        xScale.domain(d3.extent(data.vuelos.map(d => d.st))).nice();
        xAxis.call(d3.axisBottom(xScale).ticks(24))
            .selectAll("text")
                .attr("transform","rotate(90)")
                .attr("y",0)
                .attr("x",9)
                .attr("dy","0.25em")
                .attr("text-anchor","start")
                .attr("font-size","0.8rem")

        brush.call(d3.brushX().extent([[0,0],[width, height]]).on("end", function(d,i) {
                if(!d3.event.selection) {
                    delete data.filters[dimension];
                } else {
                    let brushed = d3.event.selection.slice()
                    data.filters[dimension] = function(data) {
                        return  xScale.invert(brushed[0]) < data["st"] && data["st"] < xScale.invert(brushed[1])
                    }
                }

                dispatch.call("filter", this, data)
        
                }))
        drawHistograma(data);
    })
    dispatch.on("filter.histograma", drawHistograma);           
}); 





dispatch.on("load.tablavuelos", function() {
    let headers = ["Tipo","Aerolinea","Vuelo","ST","ET","AT","Demora (sobre +-15min)","Ruta","Terminal","Remark"]
    let tabla = d3.select(".tablavuelos")
        .append("table")
        
    tabla.append("thead")
        .selectAll("td")
        .data(headers)
        .enter()
        .append("th")
        .text(d => d)
        .on("click",function(d) {
            d3.select(".body-vuelos").selectAll("tr").sort((a,b) => d3.ascending(a[d],b[d]));
        });
    
    let tbody = tabla.append("tbody")
        .attr("class","body-vuelos");
    let timeFormat = d => {
        if (d === null) return "";
        return d3.timeFormat("%d/%m/%Y %H:%M %p")(d)
    }
    dispatch.on("update.tablavuelos filter.tablavuelos", function(data){
        let filteredData = data.dimFilter();   

        let update = tbody.selectAll("tr")
            .data(filteredData)

        let td =    update.enter()
            .append("tr")
            .merge(update)
            .selectAll("td")
            .data(d => [d.tipo, d.aerolinea, d.vuelo, timeFormat(d.st),timeFormat(d.et),timeFormat(d.at),d.delta, d.ruta,d.term, d.remark])
        
        td.enter()
            .append("td")
            .merge(td)
            .text(d => d)
        update.exit().remove()
    })

})





function barChart() {
    let margin = {top: 0, bottom: 0, left: 0, right: 0},
        width = 200;
        height = 200;

    function chart(selection) {
        selection.data
    }

    chart.width = function (value) {
        if(!arguments.length) return width;
        width = value;
        return chart;
    }

    chart.height = function (value) {
        if(!arguments.length) return height;
        height = value;
        return chart;
    }

    chart.margin = function (value) {
        if(!arguments.length) return margin;
        margin = value;
        return chart;
    }

    return chart;
}

dispatch.on("load.delays", function(){
    let dimension = "delta"
    let margin = {top: 25, bottom: 25, right: 40, left: 40},
    width = 700 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

    let svg = d3.select(".delays")
        .append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
            .attr("transform",`translate(${margin.left},${margin.top})`);

    let xAxis = svg.append("g").attr("transform",`translate(0,${height})`);


    let yAxis = svg.append("g");
    let yScale = d3.scaleLinear()
        .range([height, 0])
    
    let timeInterval = 15;

    dispatch.on("update.delays", function(data){

        ;(function () {
            let dimension = "tableFilter";
            let timeout;
            let text;
            d3.select(myInput).on("keyup", function() {
                text = this.value;
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    if(text.length) {
                        data.filters[dimension] = function(flight) {
                            return JSON.stringify(flight).toUpperCase().indexOf(text.toUpperCase()) !== -1 ? true : false; 
                        }
                    } else {
                        delete data.filters[dimension];
                    }
                    dispatch.call("filter",null,test)
                },300)
                
            })
        })();


        let nest = d3.nest().key(d => Math.floor(d.delta/timeInterval) * timeInterval).entries(data.vuelos);
        let extents = d3.extent(nest, d => Number(d.key));
        extents[0] -= timeInterval; // agrando el dominio
        extents[1] += timeInterval;
        let xScale = d3.scaleLinear()
            .range([0, width])
            .domain(extents);
        xAxis.call(d3.axisBottom(xScale));

        let brush = svg.append("g")
        .attr("class","brush")
        setTimeout(() => {
            brush.call(d3.brushX().extent([[0,0],[width, height]]).on("end", function(d,i) {
                if(!d3.event.selection) {
                    delete data.filters[dimension];
                } else {
                    let brushed = d3.event.selection.slice()
                    data.filters[dimension] = function(data) {
                        return  xScale.invert(brushed[0]) < data[dimension] && data[dimension] < xScale.invert(brushed[1])
                    }
                }
    
                dispatch.call("filter", this, data)
        
            }))
        },0)



        
        dispatch.on("filter.delays", function(data) {
            let filteredData = data.dimFilter(dimension);
            let nest = d3.nest().key(d => Math.floor(d.delta/timeInterval) * timeInterval).entries(filteredData.filter(d => d.delta));
            let yMax = d3.max(nest, d => d.values.length);
            yScale.domain([0, yMax]).nice();
            yAxis.call(d3.axisLeft(yScale).ticks(10,",f"));

            let rects = svg.selectAll(".data")
                .data(nest, d => d.key);
            rects.enter()
                .append("rect")
                .attr("class","data")
                .merge(rects)
                .attr("width", 10)
                .attr("x", d => xScale(Number(d.key)))
                .attr("y", d => yScale(d.values.length))
                .attr("height", d => height - yScale(d.values.length));
            rects.exit().remove();
        })
    });

})



dispatch.call("load");