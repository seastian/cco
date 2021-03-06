let dispatch = d3.dispatch("update", "filter","clearFilter");

let duration = 1000;
// Actualizar cada 4 min
; (function () {
    let data = {};
    data.filters = {};
    function load() {
        let url = "https://api.github.com/repos/seastian/cco/contents/data.json";
        d3.json(url).then(function (rawData) {
            rawData = JSON.parse(atob(rawData.content));
            data.vuelos = rawData.vuelos;
            let timeParser = d3.timeParse("%d/%m/%Y %H:%M");
            data.lastUpdate = timeParser(rawData.lastUpdate);
            data.vuelos.forEach((d) => {
                d.fullName = d.aerolinea + d.vuelo;
                let delayTrigger = 15; // 15 min
                d.et = timeParser(d.et);
                d.st = timeParser(d.st);
                d.at = timeParser(d.at);
                d.delta = (() => {
                    if (d.remark === "CON" || d.remark === "CAN" || d.remark === "DES" || d.remark === "ALT" || d.remark === "REP") {
                        return null;
                    } else if (d.at) {
                        if (Math.abs(d.at - d.st) > 15 * 60 * 1000)
                            return Math.sign(d.at - d.st) * (Math.abs(d.at - d.st) / 1000 / 60 - delayTrigger);
                        else return null
                    } else if ((data.lastUpdate - d.st) > delayTrigger * 60 * 1000) { // hace 15 min que no llego
                        return Math.round((data.lastUpdate - d.st) / 1000 / 60 - delayTrigger);
                    } else if (d.et) { // mayor a 15 min
                        if (Math.abs(d.et - d.st) > delayTrigger * 60 * 1000) {
                            return Math.sign(d.et - d.st) * (Math.abs(d.et - d.st) / 1000 / 60 - delayTrigger)
                        } else {
                            return null;
                        }
                    } else {
                        return null;
                    }
                })();
            });
            data.vuelos = data.vuelos.filter(d => d.aerolinea !== "PRV" && d.aerolinea !== "FAA" && Math.abs(d.st - d3.timeHour(data.lastUpdate)) < 12 * 60 * 60 * 1000);
            data.dimFilter = function (dimension) {
                return this.vuelos.filter(vuelo => {
                    for (let j in this.filters) {
                        if (j === dimension) continue;
                        if (!(this.filters[j](vuelo))) return false;
                    }
                    return true;
                })
            };
            dispatch.call("update", null, data)
            dispatch.call("filter");
        });
    }
    dispatch.on("clearFilter",function(dimension) {
        delete data.filters[dimension];
        if(dimension === "st") {
            d3.select(".histograma .brush").call(d3.brushX().move,null);
        } else if(dimension === "delta") {
            d3.select(".delays .brush").call(d3.brushX().move,null);
            // d3.select(".delays .brush rect:not(.overlay)")
            //     .style("display", "none");
        }
        dispatch.call("filter")
    })
    load();
    setInterval(load, 4 * 60 * 1000);
})();

// Last Update
dispatch.on("update.lastupdate", function (data) {
    d3.select(".lastupdate").text(d3.timeFormat("%d/%m %H:%M")(data.lastUpdate));
    d3.select("header img").on("click", () => {
        data.filters = {};
        d3.select(".delays .brush").call(d3.brushX().move,null);
        d3.select(".histograma .brush").call(d3.brushX().move,null);
        document.querySelector("#myInput").value = null;
        dispatch.call("filter");
    });
    d3.select(".fa-file-excel")
        .on("click", function () {
            let workbook = XLSX.utils.table_to_book(document.querySelector(".tablavuelos table"));
            XLSX.writeFile(workbook, 'cco.xlsx');
        })
});

// Grafico Aerolineas
; (function () {
    let dimension = "aerolinea";

    let container = d3.select(".aerolinea");

    let clientWidth = container.node().getBoundingClientRect().width;

    let margin = { top: 0, bottom: 0, right: 0, left: 0 },
        width = clientWidth - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    container.call(titleBar, "Aerolineas",dimension);

    let svg = container.append("div")
        .classed("content",true)
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let treemapLayout = d3.treemap()
        .size([width, height])
        .tile(d3.treemapBinary)
        .padding(2)
        .round(true)

    let tooltip = d3.select("body").append("div")
        .classed("tooltip", true);

    dispatch.on("update.aerolinea", function (data) {
        dispatch.on("filter.aerolinea", function () {
            let filteredData = data.dimFilter(dimension);
            let root = treemapLayout(d3.hierarchy({ children: d3.nest().key(d => d.aerolinea).rollup(d => d.length).entries(filteredData) })
                .sum(d => d.value)
                .sort((a, b) => d3.ascending(a.data.key, b.data.key)));


            let u = svg.selectAll("g")
                .data(root.leaves());

            let g = u.enter()
                .append("g");

            g.append("rect")
                .classed("clickable", true)
                .on("mouseover", function (d) {
                    let text = d.data.key + ": " + d.data.value
                    tooltip.text(text)
                        .style("display", "block")
                        .style("left", d3.event.pageX + "px")
                        .style("top", d3.event.pageY + "px")
                })
                .on("mouseleave", function (d) {
                    tooltip.style("display", null)
                })
                .on("mousemove", function () {
                    tooltip.style("left", d3.event.pageX + 10 + "px")
                        .style("top", d3.event.pageY + 30 + "px")
                })
                .merge(u.select("rect"))
                .on("click", function (d) {
                    data.filters[dimension] = (vuelo) => vuelo.aerolinea === d.data.key;
                    dispatch.call("filter");
                })
                .attr("x", d => d.x0)
                .attr("y", d => d.y0)
                .attr("width", d => d.x1 - d.x0)
                .attr("height", d => d.y1 - d.y0)
                .attr("fill", "#39acd7")
                .attr("data-aero",d => d.data.key);

            g.append("text")
                .classed("ignore-events", true)
                .merge(u.select("text"))
                .attr("x", d => d.x0)
                .attr("y", d => d.y0)
                .text(d => d.data.key)
                .attr("dy", "0.9em")
                .attr("fill","white")
                .attr("font-size",14);

            u.exit().remove();

            svg.selectAll("rect").classed("not-selected", function (d) {
                if (dimension in data.filters) {
                    return !data.filters[dimension]({ aerolinea: d.data.key })
                } else {
                    return false;
                }
            })



        });
    });
})();

//Grafico Ruta
; (function () {
    let dimension = "ruta";

    let container = d3.select(".ruta");
    let clientWidth = container.node().getBoundingClientRect().width;

    let margin = { top: 2, bottom: 2, right: 2, left: 2 },
        width = clientWidth - margin.left - margin.right,
        height = clientWidth - margin.top - margin.bottom;

    container.call(titleBar, "Rutas",dimension);

    let svg = container.append("div")
        .classed("content",true)    
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let pack = d3.pack()
        .size([width, height])
        .padding(5);

    let tooltip = d3.select("body").append("div")
        .classed("tooltip", true)

    let color = d3.scaleOrdinal(d3.schemeCategory10);    

    dispatch.on("update.ruta", function (data) {
        dispatch.on("filter.ruta", function () {
            let filteredData = data.dimFilter(dimension);
            let nest = d3.nest().key(d => d.ruta).rollup(d => {
                return {
                arribos: d.filter(d => d.tipo === "arribo").length,
                partidas: d.filter(d => d.tipo === "partida").length,
                total: d.length}
            }).entries(filteredData);
            let root = pack(d3.hierarchy({ values: nest, value: {total: null} }, d => d.values).sum(d => d.value.total));
            let update = svg.selectAll(".data")
                .data(root.leaves(), d => d.data.key);

            let gdata = update.enter()
                .append("g")
                .classed("data", true)
                .attr("transform", d => `translate(${d.x},${d.y})`);


            gdata.append("circle")
                .classed("clickable", true)
                .attr("r", d => d.r)
                .attr("fill", d => color(Math.random()))
                .on("click", function (d) {
                    data.filters[dimension] = (vuelo) => vuelo.ruta === d.data.key;
                    d3.event.stopPropagation();
                    dispatch.call("filter");
                })
                .on("mouseover", function (d) {
                    let text = d.data.key + ": " + d.data.value.total + ", Arribos: " + d.data.value.arribos
                        + ", Partidas: " + d.data.value.partidas;
                    tooltip.text(text)
                        .style("display", "block")
                        .style("left", d3.event.pageX + 30 + "px")
                        .style("top", d3.event.pageY + 30 + "px")
                })
                .on("mouseleave", function (d) {
                    tooltip.style("display", null)


                })
                .on("mousemove", function () {
                    tooltip.style("left", d3.event.pageX + 30 + "px")
                        .style("top", d3.event.pageY + 30 + "px")
                })

            gdata.append("text")
                .classed("ignore-events", true)
                .text(d => d.data.key)
                .attr("text-anchor", "middle")
                .attr("font-size", "0.6em")
                .attr("dy", "0.32em")
                .attr("fill","white");

            update
                .transition()
                .attr("transform", d => `translate(${d.x},${d.y})`);

            update.select("circle")
                .transition()
                .attr("r", d => d.r);

            update.exit().remove();

            svg.selectAll("g.data").classed("not-selected", function (d) {
                if (dimension in data.filters) {
                    return !data.filters[dimension]({ ruta: d.data.key })
                } else {
                    return false;
                }
            })
        });
    });
})();

//Grafico Terminal
; (function () {
    let margin = { top: 2, bottom: 2, right: 2, left: 2 },
        width = 100 - margin.left - margin.right,
        height = 100 - margin.top - margin.bottom;

    let dimension = "terminal";
    d3.select(".terminal").call(titleBar, "Terminales",dimension)
    let svg = d3.select(".terminal").append("div")
        .classed("content",true)
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let pack = d3.pack()
        .size([width, height])
        .padding(3);

    dispatch.on("update.terminal", function (data) {
        dispatch.on("filter.terminal", function () {
            let filteredData = data.dimFilter(dimension);
            let nest = d3.nest().key(d => d.term).rollup(d => d.length).entries(filteredData);
            let root = pack(d3.hierarchy({ values: nest }, d => d.values).sum(d => d.value));

            let update = svg.selectAll(".data")
                .data(root.leaves(), d => d.data.key);

            let gdata = update.enter()
                .append("g")
                .classed("data", true)
                .attr("transform", d => `translate(${d.x},${d.y})`);

            gdata.append("circle")
                .classed("clickable", true)
                .attr("r", d => d.r)
                .attr("fill", "steelblue")
                .on("click", function (d) {
                    data.filters[dimension] = (vuelo) => vuelo.term === d.data.key;
                    dispatch.call("filter");
                })

            gdata.append("text")
                .classed("ignore-events", true)
                .text(d => d.data.key)
                .attr("text-anchor", "middle")
                .attr("font-size", "0.2em")
                .attr("dy", "0.32em");

            update
                .transition()
                .attr("transform", d => `translate(${d.x},${d.y})`);

            update.select("circle")
                .transition()
                .attr("r", d => d.r)
                .attr("fill", "steelblue");

            update.exit().remove();

            svg.selectAll("g.data").classed("not-selected", function (d) {
                if (dimension in data.filters) {
                    return !data.filters[dimension]({ term: d.data.key })
                } else {
                    return false;
                }
            })
        });
    });
})();

// Grafico vuelos por hora
; (function () {
    let dimension = "st";
    let container = d3.select(".histograma");
    let clientWidth = container.node().getBoundingClientRect().width;
    let margin = { top: 20, bottom: 25, right: 25, left: 32 },
        width = clientWidth - margin.left - margin.right,
        height = clientWidth / 1.2 - margin.top - margin.bottom;

    container.call(titleBar,"Vuelos por hora",dimension);

    let svg = container.append("div")
        .classed("content",true)
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    let newSvg = svg.append("g");
    svg.append("text")
        .text("Cantidad de vuelos")
        .attr("transform","rotate(-90) translate(-3,18)")
        .attr("text-anchor","end")
        .attr("fill","white")
        .attr("font-size","0.7em");

    svg.append("text")
        .text("Horas")
        .attr("transform",`translate(${width},${height - 5})`)
        .attr("text-anchor","end")
        .attr("fill","white")
        .style("font-size","0.7em");

    let xScale = d3.scaleTime()
        .range([0, width]);
    let xAxis = svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .classed("axis", true);
    let yScale = d3.scaleLinear()
        .range([height, 0])
        .domain([0, 14]);
    let yAxis = svg.append("g")
        .classed("axis", true);

    let brush = svg.append("g")
        .attr("class", "brush");

    let barWidth = (width / 24 - 5) / 2;
    dispatch.on("update.histograma", function (data) {
        xScale.domain([d3.timeHour.offset(d3.timeHour(data.lastUpdate), -12), d3.timeHour.offset(d3.timeHour(data.lastUpdate), 12)]);
        let yMax = d3.max(d3.nest()
            .key(d => d3.timeHour(d.st).getTime() + d.tipo)
            .rollup(d => d.length)
            .entries(data.vuelos), d => d.value);
        yScale.domain([0, yMax]);

        yAxis.call(d3.axisLeft(yScale));

        xAxis.call(d3.axisBottom(xScale).tickFormat(d3.timeFormat("%H")))

        brush.call(d3.brushX().extent([[0, height + 1], [width, height + margin.bottom - 1]]).on("end", function (d, i) {
            if (!d3.event.selection) {
                delete data.filters[dimension];
            } else {
                let min = d3.event.selection[0];
                let max = d3.event.selection[1];
                d3.brushX().move(brush, [xScale(d3.timeHour.round(xScale.invert(min))), xScale(d3.timeHour.round(xScale.invert(max)))]);
                data.filters[dimension] = function (data) {
                    return d3.timeHour.round(xScale.invert(min)) <= data["st"] && data["st"] < d3.timeHour.round(xScale.invert(max));
                }
            }
            dispatch.call("filter")
        }));
        svg = newSvg;
        dispatch.on("filter.histograma", function () {
            let filteredData = data.dimFilter(dimension);
            let nest = d3.nest()
                .key(d => d3.timeHour(d.st).getTime())
                .key(d => d.tipo)
                .entries(filteredData);
            let gHoras = svg.selectAll("g.horas")
                .data(nest, d => d.key)
                .join(
                    enter => enter.append("g"),
                    null,
                    exit => exit.selectAll("rect").transition()
                    .duration(duration)
                    .attr("y", height)
                    .attr("height", 0)
                )
                .classed("horas", true)
                .attr("transform", d => `translate(${xScale(Number(d.key))},0)`)
                .classed("not-selected", function (d) {
                    if (dimension in data.filters) {
                        return !data.filters[dimension]({ st: d.key })
                    } else {
                        return false;
                    }
                })
                .selectAll("rect")
                .data(d => d.values, d => d.key)
                .join(enter => {
                    return enter.append("rect")
                        .attr("x", d => d.key === "arribo" ? 1 : barWidth + 3)
                        .attr("width", barWidth)
                        .attr("class", d => d.key)
                        .attr("y", height)
                        .attr("height", 0)
                },null,
                exit => exit.transition()
                .duration(duration)
                .attr("y", height)
                .attr("height", 0)
                )
                .transition()
                .duration(duration)
                .attr("y", (d) => yScale(d.values.length))
                .attr("height", (d) => height - yScale(d.values.length))
        });
    })

})();

// Genero Tabla de Vuelos, se puede filtar
; (function () {
    let columnas = [
        { key: "tipo", name: "Tipo", parse: tipo => tipo === "arribo" ? "A" : tipo === "partida" ? "P" : tipo },
        { key: "aerolinea", name: "Aero" },
        { key: "vuelo", name: "Vuelo" },
        { key: "ruta", name: "Ruta" },
        { key: "interDom", name: "I/D" },
        { key: "st", name: "ST", parse: d3.timeFormat("%d/%m %H:%M") },
        { key: "et", name: "ET", parse: d3.timeFormat("%H:%M") },
        { key: "at", name: "AT", parse: d3.timeFormat("%H:%M") },
        { key: "delta", name: "Dem" },
        { key: "remark", name: "Rem" },
        { key: "posicion", name: "Posición" },
        { key: "puerta", name: "Puerta" },
        { key: "cinta", name: "Cinta" },
        { key: "chkFrom", name: "chkF", parse: d => d.replace(/^0+/, '') },
        { key: "chkTo", name: "chkT", parse: d => d.replace(/^0+/, '') },
        { key: "pax", name: "Pax" },
        { key: "term", name: "Ter" },
    ];
    let flag = true;

    let tabla = d3.select(".tablavuelos")
        .append("table");

    let rh = tabla.append("thead")
        .append("tr")
        .selectAll("th")
        .data(columnas)
        .enter()
        .append("th")
        .text(d => d.name);

    rh.filter(d => d.key === "delta")
        .classed("demTooltip",true)
        .append("i")
        .attr("class", "fas fa-info")
        .style("padding-left","0.3em")
        .style("font-size","0.7em")
        .style("vertical-align","top")
        .style("color","yellow")
        .append("div")
        .classed("tooltipDemDiv", true)
        .text("Un vuelo se considera demorado cuando su horario difiere en por lo menos 15 minutos del horario programado. La demora se muestra como los minutos excedentes sobre 15 minutos.")
        .style("font-size","1rem")
        .style("padding","0.5rem")
        .style("min-width","200px")
        .style("font-family","Open Sans");

    rh.append("i")
        .attr("class", "fas fa-sort")
        .style("padding-left", "0.5em")
        .on("click", function (d) {
            let sortMethod = flag ? d3.ascending : d3.descending;
            flag = !flag;
            d3.select(".body-vuelos").selectAll("tr").sort((a, b) => sortMethod(a[d.key], b[d.key]));
        });

    let tbody = tabla.append("tbody")
        .attr("class", "body-vuelos");

    dispatch.on("update.tablavuelos", function (data) {
        ; (function () {
            let dimension = "tableFilter";
            let timeout;
            let text;
            d3.select("#myInput").on("keyup", function () {
                if(d3.event.key === "Enter") {
                    this.blur();
                } else {
                    text = this.value;
                    clearTimeout(timeout);
                    timeout = setTimeout(() => {
                        if (text.length) {
                            data.filters[dimension] = function (flight) {
                                return JSON.stringify(flight).toUpperCase().indexOf(text.toUpperCase()) !== -1 ? true : false;
                            }
                        } else {
                            delete data.filters[dimension];
                        }
                        dispatch.call("filter");
                    }, 350)
                }
            })
        })();
        dispatch.on("filter.tablavuelos", function () {
            let filteredData = data.dimFilter();
            tbody.selectAll("tr")
                .data(filteredData)
                .join("tr")
                .selectAll("td")
                .data(columnas)
                .join("td")
                .text(function (d) {
                    let rowData = d3.select(this.parentElement).datum();
                    if (d.key in rowData && rowData[d.key]) { // Comparador Lazy
                        return "parse" in d ? d.parse(rowData[d.key]) : rowData[d.key];
                    } else {
                        return '\xa0';
                    }
                })
                .style("color",function(d) {
                    if(d.key === "tipo") {
                        let rowData = d3.select(this.parentElement).datum();
                        let colors = {
                            arribo: "#e09431",
                            partida: "#2aa7d8"
                        };
                        if(rowData.tipo in colors) {
                            return colors[rowData.tipo];
                        } else {
                            return null;
                        }
                    } else {
                        return null;
                    }
                })
        });
    })
})();

// Grafico Delays
; (function () {
    let dimension = "delta";
    let container = d3.select(".delays");
    let clientWidth = container.node().getBoundingClientRect().width;

    let margin = { top: 25, bottom: 25, right: 20, left: 40 },
        width = clientWidth - margin.left - margin.right,
        height = clientWidth / 1.2 - margin.top - margin.bottom;

    container.call(titleBar,"Demoras",dimension);

    let svg = container
        .append("div")
        .classed("content",true)
        .append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

    let newSvg = svg.append("g");

    svg.append("text")
        .text("Cantidad de vuelos")
        .attr("transform","rotate(-90) translate(-3,18)")
        .attr("text-anchor","end")
        .attr("fill","white")
        .style("font-size","0.7em");

    svg.append("text")
        .text("Minutos")
        .attr("transform",`translate(${width},${height - 5})`)
        .attr("text-anchor","end")
        .attr("fill","white")
        .style("font-size","0.7em");

    let xAxis = svg.append("g").attr("transform", `translate(0,${height})`);
    let yAxis = svg.append("g");

    let yScale = d3.scaleLinear()
        .range([height, 0])

    let brush = svg.append("g")
        .attr("class", "brush");

    let timeInterval = 15;

    svg = newSvg;
    dispatch.on("update.delays", function (data) {
        let nest = d3.nest().key(d => Math.floor(d.delta / timeInterval) * timeInterval).entries(data.vuelos);
        let extents = d3.extent(nest, d => Number(d.key));
        extents[0] -= timeInterval; // agrando el dominio
        extents[1] += timeInterval;
        let xScale = d3.scaleLinear()
            .range([0, width])
            .domain(extents);

        xAxis.call(d3.axisBottom(xScale).ticks(6));

        brush.call(d3.brushX().extent([[0, height + 1], [width, height + margin.bottom - 1]]).on("end", function (d, i) {
            if (!d3.event.selection) {
                delete data.filters[dimension];
            } else {
                let brushed = d3.event.selection.slice()
                data.filters[dimension] = function (data) {
                    return xScale.invert(brushed[0]) < data[dimension] && data[dimension] < xScale.invert(brushed[1])
                }
            }
            dispatch.call("filter")
        }))

        dispatch.on("filter.delays", function () {
            let filteredData = data.dimFilter(dimension);
            let nest = d3.nest().key(d => Math.floor(d.delta / timeInterval) * timeInterval).entries(filteredData.filter(d => d.delta));
            let yMax = d3.max(nest, d => d.values.length);
            yScale.domain([0, yMax]);
            let step = yScale.domain()[1] > 10 ? 2 : 1;
            yAxis.transition()
                .duration(duration)
                .call(d3.axisLeft(yScale).tickValues(d3.range(0, yScale.domain()[1] + 1,step)).tickFormat(d3.format("d")));

            let gs = svg.selectAll(".data")
                .data(nest, d => d.key)
                .join("g")
                .attr("class", "data")
                .attr("transform",d => `translate(${xScale(Number(d.key))},${yScale(d.values.length)})`);

            gs.selectAll("line").data(d => [d])
                .join("line")
                .attr("stroke","#69b866")
                .attr("stroke-width","3")
                .attr("y2", d => height - yScale(d.values.length));
            gs.selectAll("circle").data(d => [d])
                .join("circle")
                .attr("r", 4)
                .attr("fill","#69b866");
        })
    });
})();

// Grafico Posiciones
; (function () {
    let dimension = "posiciones"
    let margin = { top: 10, bottom: 10, right: 10, left: 10 },
        width = 250 - margin.left - margin.right,
        height = 250 - margin.top - margin.bottom;

    d3.select(".posiciones").call(titleBar, "Posiciones",dimension)
    let svg = d3.select(".posiciones")
        .append("div")
        .classed("content",true)
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left + width / 2},${margin.top + height / 2})`);

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

    dispatch.on("update.posiciones", function (data) {
        dispatch.on("filter.posiciones", function () {
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
                .classed("groups", true);

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
                .attr("font-size", "0.3em")
                .attr("fill","white");

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
                .attr("font-size", "0.3em");

            group.exit().remove();


            chordsG.selectAll("path")
                .data(chords)
                .join("path")
                .attr("stroke", d => d3.rgb(color(d.source.index)).darker())
                .attr("fill", d => color(d.source.index))
                .attr("d", ribbon)
                .on("mouseenter", function () {
                    d3.select(this).raise();
                })
                .on("click", function(d) {
                    let pos = labels[d3.max([d.source.index,d.target.index])];
                    pos = pos === "N/A" ? "" : pos;
                    data.filters[dimension] = vuelo => vuelo.posicion === pos;
                    dispatch.call("filter");
                })
                .classed("not-selected", function (d) {
                    if (dimension in data.filters) {
                        let pos = labels[d3.max([d.source.index,d.target.index])];
                        pos = pos === "N/A" ? "" : pos;
                        return !data.filters[dimension]({ posicion: pos })
                    } else {
                        return false;
                    }
                })
        });
    });
})();

// Totales
; (function () {
    let container = d3.select(".totals");
    let dimension = "totals"
    container.call(titleBar, "Totales", dimension);
    let totArribos = container.select(".totArribos");
    let totPartidas = container.select(".totPartidas");
    let totAerolineas = container.select(".totAerolineas");
    dispatch.on("update.totals", function (data) {
        dispatch.on("filter.totals", function () {
            let filteredData = data.dimFilter();
            totPartidas.text(filteredData.filter(d => d.tipo === "partida").length);
            totArribos.text(filteredData.filter(d => d.tipo === "arribo").length);
            totAerolineas.text((new Set(filteredData.map(d => d.aerolinea)).size));

            d3.select(".totA").on("click", function () {
                data.filters[dimension] = (vuelo) => vuelo.tipo === "arribo";
                dispatch.call("filter");
            });
            d3.select(".totP").on("click", function () {
                data.filters[dimension] = (vuelo) => vuelo.tipo === "partida";
                dispatch.call("filter");
            });
        });
    });
})();

// Mostradores
; (function () {
    let dimension = "mostradores";
    let container = d3.select(".mostradores");
    container.call(titleBar, "Mostradores",dimension);

    let content = container
        .append("div")
        .classed("content",true);

    let radios = content.append("form");

    let checkbox = radios.append("input").attr("type","checkbox")
        .attr("name","formato")
        .attr("value","agrupados")
        .on("change", function() {
            dispatch.call("filter");
        })
        // .property("checked",true);

    radios.append("label")
        .text("Agrupados")

    let canvas = content.append("div")
        .classed("flexcontainer", true);

    let tooltip = d3.select("body")
        .append("div")
        .classed("tooltip", true);

    dispatch.on("update.mostradores", function (data) {
        dispatch.on("filter.mostradores", function () {
            let filteredData = data.dimFilter(dimension);
            let mostradores = {};
            filteredData.forEach(function (vuelo) {
                if ("chkFrom" in vuelo && vuelo.chkFrom && "chkTo" in vuelo && vuelo.chkTo) {
                    d3.range(Number(vuelo.chkFrom), Number(vuelo.chkTo) + 1).forEach(function (mostrador) {
                        if (mostrador in mostradores) {
                            mostradores[mostrador].vuelos.push(vuelo);
                        } else {
                            mostradores[mostrador] = {};
                            mostradores[mostrador].mostrador = mostrador;
                            mostradores[mostrador].vuelos = [];
                            mostradores[mostrador].vuelos.push(vuelo);
                        }
                    });
                }
            });
            mostradores = d3.values(mostradores).sort((a, b) => d3.ascending(a.mostrador, b.mostrador));
            mostradores.forEach(mostrador => {
                mostrador.enUso = mostrador.vuelos.map(vuelo => vuelo.st).filter(st => {
                    return +d3.timeHour.offset(st,-3) < Date.now() && Date.now() < +st;
                }).length;
            });

            // Try to merge Mostradores
            if(checkbox.property("checked")) {
                let mergedMostradores = [];
                mergedMostradores.push(Object.assign({},mostradores[0]));
                for(let j=1; j < mostradores.length; j++) {
                    let lastMerged = Array.from(new Set(mergedMostradores[mergedMostradores.length-1].vuelos.map(vuelo => vuelo.aerolinea))).sort().join();
                    let current = Array.from(new Set(mostradores[j].vuelos.map(vuelo => vuelo.aerolinea))).sort().join()
                    if (lastMerged === current) {
                        // Merge, pop and push
                        let last = mergedMostradores.pop();
                        last.mostrador += ", " + mostradores[j].mostrador;
                        last.vuelos = last.vuelos.concat(mostradores[j].vuelos);
                        last.enUso += mostradores[j].enUso;
                        mergedMostradores.push(last);
                    } else {
                        mergedMostradores.push(Object.assign({},mostradores[j]));
                    }
                }
                mergedMostradores.forEach(mostrador => {
                    if(typeof mostrador.mostrador === "string") {
                        mostrador.mostrador = d3.extent(mostrador.mostrador.split(", ")).join("...");
                    }
                });
                mostradores = mergedMostradores;
            }

            canvas.selectAll("div")
                .data(mostradores, mostradores.mostrador)
                .join("div")
                .text(d => d.mostrador)
                .classed("clickable", function() {
                    if(checkbox.property("checked")) {
                        return false;
                    } else {
                        return true;
                    }
                })
                .classed("not-selected", function (d) {
                    if (dimension in data.filters) {
                        return !data.filters[dimension]({ chkFrom: d.mostrador, chkTo: d.mostrador })
                    } else {
                        return false;
                    }
                })
                .classed("mostrador-activo",function(mostrador) {
                    return mostrador.enUso;
                })
                .on("click", function (d) {
                    if(checkbox.property("checked")) {
                        // data.filters[dimension] = vuelo => {
                        //     if ("chkFrom" in vuelo && vuelo.chkFrom && "chkTo" in vuelo && vuelo.chkTo) {
                        //         let rangoVuelo = d3.range(Number(vuelo.chkFrom), Number(vuelo.chkTo) + 1);
                        //         let rangoMostradores = d3.range(Number(d.mostrador.split("...")[0]), Number(d.mostrador.split("...")[1]) + 1);
                        //         for(j = 0; rangoVuelo.length; j++) {
                        //             if(rangoMostradores.indexOf(rangoVuelo[j]) === -1) {
                        //                 return false;
                        //             }
                        //         }
                        //         return true;
                        //     }
                        //     else {
                        //         return false;
                        //     }
                        // };
                    } else {
                        data.filters[dimension] = vuelo => {
                            if ("chkFrom" in vuelo && vuelo.chkFrom && "chkTo" in vuelo && vuelo.chkTo) {
                                return d3.range(Number(vuelo.chkFrom), Number(vuelo.chkTo) + 1).indexOf(d.mostrador) !== -1 ? true : false;
                            }
                            else {
                                return false;
                            }
                        };
                    }

                    dispatch.call("filter");
                })
                .call(genTooltip, tooltip, function (d, i) {
                    return "Aerolineas: \n" + Array.from(new Set(d.vuelos.map(d => d.aerolinea))).join(", ");
                })

        });
    });
})();

function titleBar(selection,title,dimension) {
    let titleDiv = selection.selectAll(".title-bar")
        .data([null])
        .enter()
        .insert("div", ":first-child")
        .classed("title-bar", true);

    titleDiv.append("span")
        .text(title)
        .classed("title",true)

    let icons = titleDiv.append("span")
        .classed("right-icons",true);

    icons.append("i")
        .classed("fas fa-eraser", true)
        .classed("clickable", true)
        .on("click", function() {
            dispatch.call("clearFilter",null,dimension)
        });

    icons.append("i")
        .classed("fas fa-chevron-down", true)
        .classed("clickable", true)
        .on("click", function () {
            let content = selection.select(".content");
            let status = content.classed("hide")
            content.classed("hide", !status);
        })

    icons.append("i")
        .classed("fas fa-expand", true)
        .classed("clickable", true)
        .on("click", function () {
            let flag = selection.classed("zoom");
            selection.classed("zoom", !flag);
        });
}

function genTooltip(selection, tooltip, format) {
    selection.on("mouseover", function (d, i) {
        tooltip.text(format(d, i))
            .style("display", "block")
            .style("left", d3.event.pageX + "px")
            .style("top", d3.event.pageY + "px")
    })
        .on("mouseleave", function () {
            tooltip.style("display", null)
        })
        .on("mousemove", function () {
            tooltip.style("left", d3.event.pageX + "px")
                .style("top", d3.event.pageY + 30 + "px")
        })
}

if(document.querySelector("body").getBoundingClientRect().width <= 667) {
    d3.selectAll(".content").classed("hide",true);
};