let dispatch = d3.dispatch("update","filter");
let test;
let test2;

// Actualizar cada 4 min
;(function() {
    let data = {};
    data.filters = {};
    function load() {
        let url = "https://api.github.com/repos/seastian/cco/contents/data.json";
        d3.json(url).then(function(rawData) {
        rawData = JSON.parse(atob(rawData.content));
        data.vuelos = rawData.vuelos;
        let timeParser = d3.timeParse("%d/%m/%Y %H:%M");
        data.lastUpdate = timeParser(rawData.lastUpdate);
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
        data.dimFilter = function(dimension) {
            return this.vuelos.filter(vuelo => {
                for(let j in this.filters) {
                    if (j === dimension) continue;
                    if(!(this.filters[j](vuelo))) return false;
                }
                return true;
            })
        };  
        dispatch.call("update",null,data)
        dispatch.call("filter");
    });
    }
    load();  
    test = data;
    setTimeout(load,4*60*1000);
})();

// Last Update
dispatch.on("update.lastupdate", function(data) {
    d3.select(".lastupdate").text(d3.timeFormat("%d/%m %H:%M")(data.lastUpdate));
    d3.select("nav img").on("click", () => {
        data.filters = {};
        dispatch.call("filter");
    });
    d3.select("button")
    .on("click", function() {
        let workbook = XLSX.utils.table_to_book(document.querySelector(".tablavuelos table"));
        XLSX.writeFile(workbook, 'cco.xlsx');
    })
});

// Grafico Aerolineas
;(function() {
    let margin = {top: 5, bottom: 5, right: 5, left: 5},
    width = 200 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

    let dimension = "aerolinea";

    d3.select(".aerolinea").call(titleBar,"Aerolineas")
    let svg = d3.select(".aerolinea").append("svg")
        .attr("viewBox",`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform",`translate(${margin.left},${margin.top})`);
    
    let color = d3.scaleOrdinal(d3.schemeCategory10);
    let treemapLayout = d3.treemap()
            .size([width, height])
            .tile(d3.treemapBinary)
            .padding(1)
            .round(true)

    let tooltip = d3.select("body").append("div")
            .classed("tooltip",true)

    dispatch.on("update.aerolinea", function(data) {
        dispatch.on("filter.aerolinea", function() {
            let filteredData = data.dimFilter(dimension);
            let root = treemapLayout(d3.hierarchy({children: d3.nest().key(d => d.aerolinea).rollup(d => d.length).entries(filteredData)})
                .sum(d => d.value)
                .sort((a, b) => d3.ascending(a.data.key,b.data.key)));


            let u = svg.selectAll("g")
                .data(root.leaves());

            let g = u.enter()
                .append("g");

            g.append("rect")
                .on("mouseover", function(d) {
                    let text = d.data.key + ": " + d.data.value
                    tooltip.text(text)
                        .style("display","block")
                        .style("left",d3.event.pageX + "px")
                        .style("top",d3.event.pageY + "px")
                })
                .on("mouseleave", function(d) {
                    tooltip.style("display", null)
                })
                .on("mousemove", function(){
                    tooltip.style("left",d3.event.pageX + 10 + "px")
                        .style("top",d3.event.pageY + 30 + "px")
                })
                .merge(u.select("rect"))
                .on("click", function(d) {
                    data.filters[dimension] = (vuelo) => vuelo.aerolinea === d.data.key;
                    dispatch.call("filter");
                })
                .attr("x", d => d.x0)
                .attr("y", d => d.y0)
                .attr("width", d=> d.x1 - d.x0)
                .attr("height", d => d.y1 - d.y0)
                .attr("fill","steelblue");

            g.append("text")
                .merge(u.select("text"))
                .attr("x", d => d.x0)
                .attr("y", d => d.y0)
                .text(d => d.data.key)
                .attr("dy","0.9em")
                .attr("font-size", "0.6em")

            u.exit().remove();

            svg.selectAll("rect").classed("not-selected", function(d) {
                if(dimension in data.filters) {
                    return !data.filters[dimension]({aerolinea: d.data.key})
                } else {
                    return false;
                }
            })


            
        });
    });
})();

//Grafico Ruta
;(function(){
    let margin = {top: 2, bottom: 2, right: 2, left: 2},
        width = 300 - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;

    let dimension = "ruta";
    d3.select(".ruta").call(titleBar,"Rutas")
    let svg = d3.select(".ruta").append("svg")
        .attr("viewBox",`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform",`translate(${margin.left},${margin.top})`);
   
    let pack = d3.pack()
        .size([width, height])
        .padding(3);

    d3.select(".ruta")
        .style("position","relative")
    let tooltip = d3.select(".ruta").append("div")
        .classed("tooltip",true)

    dispatch.on("update.ruta", function(data) {
        d3.select(".ruta svg").on("click", function() {
            console.log("clicked svg")
            delete data.filters[dimension];
            dispatch.call("filter")
        });
        dispatch.on("filter.ruta", function() {
            let filteredData = data.dimFilter(dimension);
            let nest = d3.nest().key(d => d.ruta).rollup(d => d.length).entries(filteredData);
            let root = pack(d3.hierarchy({values: nest}, d => d.values).sum(d => d.value));

            let update = svg.selectAll(".data")
                .data(root.leaves(), d => d.data.key);

            let gdata = update.enter()
                .append("g")
                .classed("data", true)
                .attr("transform", d => `translate(${d.x},${d.y})`);
         

            gdata.append("circle")
                .attr("r", d => d.r)
                .attr("fill","steelblue")
                .on("click", function(d) {
                    data.filters[dimension] = (vuelo) => vuelo.ruta === d.data.key;
                    d3.event.stopPropagation();
                    console.log("clicked circle")
                    dispatch.call("filter");
                })
                .on("mouseover", function(d) {
                    let text = d.data.key + ": " + d.data.value
                    tooltip.text(text)
                        .style("display","block")
                        .style("left",d3.clientPoint(d3.select(".ruta").node(),d3.event)[0] + "px")
                        .style("top",d3.clientPoint(d3.select(".ruta").node(),d3.event)[1] + "px")
                })
                .on("mouseleave", function(d) {
                    tooltip.style("display", null)


                })
                .on("mousemove", function(){
                    tooltip.style("left",d3.clientPoint(d3.select(".ruta").node(),d3.event)[0]+ 15 +"px")
                        .style("top",d3.clientPoint(d3.select(".ruta").node(),d3.event)[1] - 10 + "px")
                })
                
                
                

            
            gdata.append("text")
                .text(d => d.data.key)
                .attr("text-anchor","middle")
                .attr("font-size","0.5em")
                .attr("dy","0.32em");

            update
                .transition()
                .attr("transform", d => `translate(${d.x},${d.y})`);
            
            update.select("circle")
                .transition()
                .attr("r", d => d.r)
                .attr("fill","steelblue");

            update.exit().remove();

            svg.selectAll("g.data").classed("not-selected", function(d) {
                if(dimension in data.filters) {
                    return !data.filters[dimension]({ruta: d.data.key})
                } else {
                    return false;
                }
            })
        });
    });
})();

//Grafico Terminal
;(function(){
    let margin = {top: 2, bottom: 2, right: 2, left: 2},
        width = 100 - margin.left - margin.right,
        height = 100 - margin.top - margin.bottom;

    let dimension = "terminal";
    d3.select(".terminal").call(titleBar,"Terminales")
    let svg = d3.select(".terminal").append("svg")
        .attr("viewBox",`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform",`translate(${margin.left},${margin.top})`);

    let pack = d3.pack()
        .size([width, height])
        .padding(3);

    dispatch.on("update.terminal", function(data) {
        dispatch.on("filter.terminal", function() {
            let filteredData = data.dimFilter(dimension);
            let nest = d3.nest().key(d => d.term).rollup(d => d.length).entries(filteredData);
            let root = pack(d3.hierarchy({values: nest}, d => d.values).sum(d => d.value));

            let update = svg.selectAll(".data")
                .data(root.leaves(), d => d.data.key);

            let gdata = update.enter()
                .append("g")
                .classed("data", true)
                .attr("transform", d => `translate(${d.x},${d.y})`);

            gdata.append("circle")
                .attr("r", d => d.r)
                .attr("fill","steelblue")
                .on("click", function(d) {
                    data.filters[dimension] = (vuelo) => vuelo.term === d.data.key;
                    dispatch.call("filter");
                })
                
                

            
            gdata.append("text")
                .text(d => d.data.key)
                .attr("text-anchor","middle")
                .attr("font-size","0.2em")
                .attr("dy","0.32em");

            update
                .transition()
                .attr("transform", d => `translate(${d.x},${d.y})`);
            
            update.select("circle")
                .transition()
                .attr("r", d => d.r)
                .attr("fill","steelblue");

            update.exit().remove();

            svg.selectAll("g.data").classed("not-selected", function(d) {
                if(dimension in data.filters) {
                    return !data.filters[dimension]({term: d.data.key})
                } else {
                    return false;
                }
            })
        });
    });
})();

// Grafico vuelos por hora
;(function() {
    let dimension = "st";

    let container = d3.select(".histograma");

    let clientWidth = container.node().getBoundingClientRect().width;
    let clientHeight = container.node().getBoundingClientRect().height;

    let margin = {top: 20, bottom: 20, right: 32, left: 32},
        width = clientWidth - margin.left - margin.right,
        height = clientWidth * 3 / 4 - margin.top - margin.bottom;

    let svg = container.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .append("g")
            .attr("transform",`translate(${margin.left},${margin.top})`);

    let xScale = d3.scaleTime()
            .range([0, width])
            
    let brush = svg.append("g")
        .attr("class","brush")
   
    let xAxis = svg.append("g")
        .attr("transform",`translate(0,${height})`)
        .classed("xAxis",true);

    let yScale = d3.scaleLinear()
        .range([height, 0])
        .domain([0, 14]);
    
    svg.append("g")
        .call(d3.axisLeft(yScale))
    
    dispatch.on("update.histograma", function(data) {
        xScale.domain(d3.extent(data.vuelos.map(d => d.st))).nice();

        xAxis.call(d3.axisBottom(xScale).tickFormat(d3.timeFormat("%H")))
        .attr("font-family",null)

        brush.call(d3.brushX().extent([[0,0],[width, height]]).on("end", function(d,i) {
                if(!d3.event.selection) {
                    delete data.filters[dimension];
                } else {
                    let brushed = d3.event.selection.slice()
                    data.filters[dimension] = function(data) {
                        return  xScale.invert(brushed[0]) < data["st"] && data["st"] < xScale.invert(brushed[1])
                    }
                }
                dispatch.call("filter")
                }))
        dispatch.on("filter.histograma",function() {
            let filteredData = data.dimFilter(dimension);
            let nest = d3.nest()
                .key(d => d3.timeHour(d.st).getTime())
                .key(d => d.tipo)
                .entries(filteredData);
            let gHoras = svg.selectAll("g.horas")
                .data(nest, d => d.key)
                .join("g")
                .classed("horas",true)
                .attr("transform", d => `translate(${xScale(Number(d.key))},0)`)
                .classed("not-selected", function(d) {
                    if(dimension in data.filters) {
                        return !data.filters[dimension]({st: d.key})
                    } else {
                        return false;
                    }
                })
                .selectAll("rect")
                .data(d => d.values, d => d.key)
                .join("rect")
                .attr("x",d => d.key === "arribo" ? 2 : 11)
                .attr("width",9)
                .attr("class",d => d.key)
                .attr("y",(d) => yScale(d.values.length))
                .attr("height", (d) => height - yScale(d.values.length))
        });   
    })
 
})();

// Genero Tabla de Vuelos, se puede filtar
;(function() {
    let columnas = [
        {key: "tipo", name: "T", parse: tipo => tipo === "arribo" ? "A" : tipo === "partida" ? "P" : tipo},
        {key: "aerolinea", name: "Aero"},
        {key: "vuelo", name: "Vuelo"},
        {key: "ruta", name: "Ruta"},
        {key: "interDom", name:"I/D"},
        {key: "st", name: "ST", parse: d3.timeFormat("%d/%m %H:%M")},
        {key: "et", name: "ET", parse: d3.timeFormat("%H:%M")},
        {key: "at", name: "AT", parse: d3.timeFormat("%H:%M")},
        {key: "delta", name: "Dem"},
        {key: "remark", name: "Rem"},
        {key: "posicion", name: "Posicion"},
        {key: "cinta", name: "Cinta"},
        {key: "chkFrom", name: "chkF", parse: d => d.replace(/^0+/, '')},
        {key: "chkTo", name: "chkT", parse: d => d.replace(/^0+/, '')},
        {key: "pax", name:"Pax"},
        {key: "term", name: "Ter"},
    ];
    let flag = true;

    let tabla = d3.select(".tablavuelos")
        .append("table");

    tabla.append("thead")
        .append("tr")
        .selectAll("th")
        .data(columnas)
        .enter()
        .append("th")
        .text(d => d.name)
        .append("i")
        .attr("class", "fas fa-sort")
        .style("padding-left","0.5em")
        .on("click",function(d) {
            let sortMethod = flag ? d3.ascending : d3.descending;
            flag = !flag;
            d3.select(".body-vuelos").selectAll("tr").sort((a,b) => sortMethod(a[d.key],b[d.key]));
        });

    let tbody = tabla.append("tbody")
        .attr("class","body-vuelos");

    dispatch.on("update.tablavuelos", function(data){
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
                    dispatch.call("filter");
                },300)
                
            })
        })();
        dispatch.on("filter.tablavuelos", function() {
            let filteredData = data.dimFilter();   
            tbody.selectAll("tr")
                .data(filteredData)
                .join("tr")
                .selectAll("td")
                .data(columnas)
                .join("td")
                .text(function(d) {
                    let rowData = d3.select(this.parentElement).datum();
                    if(d.key in rowData && rowData[d.key]) { // Comparador Lazy
                        return "parse" in d ? d.parse(rowData[d.key]) : rowData[d.key];
                    } else {
                        return "";
                    }
                 })
        });
    })
})();

// Grafico Delays
;(function() {
    let dimension = "delta"
    let margin = {top: 25, bottom: 25, right: 20, left: 40},
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
    
                dispatch.call("filter")
        
            }))
        },0)

        dispatch.on("filter.delays", function() {
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
})();

// Grafico Posiciones
;(function() {
    let dimension = "posiciones"
    let margin = {top: 10, bottom: 10, right: 10, left: 10},
        width = 300 - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;

    d3.select(".posiciones").call(titleBar,"Posiciones")
    let svg = d3.select(".posiciones")
        .append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
            .attr("transform",`translate(${margin.left + width/2},${margin.top + height/2})`);

    let outerRadius = Math.min(width, height) * 0.5;
    let innerRadius = outerRadius - 12;

    let chordLayout = d3.chord()
        .padAngle(.04)
        .sortSubgroups(d3.descending)
        .sortChords(d3.descending);

    let ribbon = d3.ribbon()
        .radius(innerRadius);

    let arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(innerRadius + 5)


    let color = d3.scaleOrdinal(d3.schemePaired);

    let chordsG = svg.append("g")
        .attr("fill-opacity", 0.67);

    let chordsT = svg.append("g");

    dispatch.on("update.posiciones", function(data) {
        dispatch.on("filter.posiciones", function() {
            let filteredData = data.dimFilter(dimension);
            let labels = Array.from(new Set(filteredData.map(d => d.aerolinea))).sort(d3.ascending).concat(Array.from(new Set(filteredData.map(d => d.posicion))).sort(d3.ascending)); 
            let matrix = d3.range(labels.length).map(d => d3.range(labels.length).map(d => 0));
            filteredData.forEach(d => {
                let i = labels.indexOf(d.posicion);
                let j = labels.indexOf(d.aerolinea);
                matrix[i][j] += 1;
                matrix[j][i] += 1;
            });
            labels[labels.indexOf("")] = "N/A";
            let chords = chordLayout(matrix);

            const group = chordsT.selectAll("g.groups")
                .data(chords.groups);

            let enter = group.enter()
                .append("g")
                .classed("groups",true);

            enter.append("path")
                .attr("fill", d => color(d.index))
                .attr("stroke", d => color(d.index))
                .attr("d", arc);

            enter.append("text")
                .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
                .attr("dy", ".35em")
                .attr("transform", d => `
                    rotate(${(d.angle * 180 / Math.PI - 90)})
                    translate(${innerRadius + 10})
                    ${d.angle > Math.PI ? "rotate(180)" : ""}
                `)
                .attr("text-anchor", d => d.angle > Math.PI ? "end" : null)
                .text(d => labels[d.index])
                .attr("font-size","0.3em");

            group.select("path")
                .attr("fill", d => color(d.index))
                .attr("stroke", d => color(d.index))
                .attr("d", arc);
            group.select("text")
                .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
                    .attr("dy", ".35em")
                    .attr("transform", d => `
                        rotate(${(d.angle * 180 / Math.PI - 90)})
                        translate(${innerRadius + 10})
                        ${d.angle > Math.PI ? "rotate(180)" : ""}
                    `)
                    .attr("text-anchor", d => d.angle > Math.PI ? "end" : null)
                    .text(d => labels[d.index])
                    .attr("font-size","0.3em");

            group.exit().remove();

            
            chordsG.selectAll("path")
                .data(chords)
                .join("path")
                .attr("stroke", d => d3.rgb(color(d.source.index)).darker())
                .attr("fill", d => color(d.source.index))
                .attr("d", ribbon)
                .on("mouseenter", function() {
                    d3.select(this).raise();
                })
        });
    });
})();

function titleBar(selection, title) {
    let titleDiv = selection.selectAll(".title-bar")
        .data([null])
        .enter()
        .append("div")
        .classed("title-bar",true);
    
    titleDiv.append("span")
        .text(title);

    let icons = titleDiv.append("span");

    icons.append("i")
        .classed("fas fa-trash-alt", true)
        .classed("clickable",true);

    icons.append("i")
        .classed("fas fa-expand", true)
        .classed("clickable",true)
        .on("click", function() {
            let flag = selection.classed("zoom");
            selection.classed("zoom",!flag);
        });
}