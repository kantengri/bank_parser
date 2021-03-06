// import * as React from 'react';
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import axios from 'axios'
// import logo from './logo.svg';

import PieChart, {
    Series,
    Label,
    Legend,
    Connector,
    Size,
    Export
  } from 'devextreme-react/pie-chart';
  

import {
    BrowserRouter as Router,
    Switch,
    Route,
    Link,
    useLocation,
    useHistory
} from "react-router-dom";

import MonacoEditor from '@uiw/react-monacoeditor';

// import { JsonEditor as Editor } from 'jsoneditor-react';
// import Ajv from 'ajv';
// import ace from 'brace';
// import 'brace/mode/json';
// import 'brace/theme/github';
// import JSONInput from 'react-json-editor-ajrm';
// import locale    from 'react-json-editor-ajrm/locale/en';
// CSS
import './App.css';
import 'devextreme/dist/css/dx.light.css';
// import 'jsoneditor-react/es/editor.min.css';


const { DateTime } = require("luxon");
// const ajv = new Ajv({ allErrors: true, verbose: true });

const DATE_FORMAT = "dd.LL.yyyy"

function valuetext(value) {
    return DateTime.now().minus({ days: -value }).toFormat(DATE_FORMAT);
    // return new Date(new Date().setDate(new Date().getDate() + parseInt(value))).toDateString();
}

function MinimumDistanceSlider(props) {

    const minDistance = 1;

    // const [value2, setValue2] = React.useState([-30, 0]);
    const [value, setValue] = [props.value, props.setValue]

    // transform from date string to relative days
    const value2 = value.map(_date => {
        if (_date != null) {
            return Math.round(DateTime.fromFormat(_date, DATE_FORMAT).diff(DateTime.now().startOf('day'), 'days').as('days'));
        } else {
            return 0;
        }
    });
    // console.log("value",value);
    // transform from relative days to date str
    const setValue2 = function (days) {
        setValue(days.map(day => valuetext(day)));
    };

    const [marks, setMarks] = React.useState([]);


    React.useEffect(() => {
        const fetchData = async () => {
            const result = await axios("/ranges");
            setMarks(result.data.ranges.map(d => {
                return {
                    value: d,
                    label: valuetext(d)
                }
            }));
        };
        fetchData();
    }, []);

    const handleChange2 = (event, newValue, activeThumb) => {
        if (!Array.isArray(newValue)) {
            return;
        }

        if (Math.abs(newValue[1] - newValue[0]) < minDistance) {
            if (activeThumb === 0) {
                const clamped = Math.min(newValue[0], 0 - minDistance);
                setValue2([clamped, clamped + minDistance]);
            } else {
                const clamped = Math.max(newValue[1], -124 + minDistance);
                setValue2([clamped - minDistance, clamped]);
            }
        } else {
            setValue2(newValue);
        }
    };

    return (
        <Slider
            getAriaLabel={() => 'Minimum distance shift'}
            value={value2}
            min={-124}
            max={0}
            marks={marks}
            onChange={handleChange2}
            onChangeCommitted={props.onChangeCommitted}
            valueLabelDisplay="on"
            valueLabelFormat={valuetext}
            disableSwap
        />
    );
}

function ByDayTable(props) {
    // const [data, setData] = React.useState([]);

    // React.useEffect(() => {
    //     if (!('spd_rows' in props.data)) {
    //         return;
    //     }
    //     console.log(props.data)
    //     // setData(props.data['spd_rows']);
    //   }, [props.data]);

    // const data = props.data['spd_rows']
    return (
        <table className="cart">
            <thead>
                <tr>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((h, inx) =>
                        <td key={inx}>{h}</td>
                    )}
                </tr>
            </thead>

            <tbody>
                {props.data['spd_rows'] && props.data['spd_rows'].map((row, r_inx) =>
                    <tr key={r_inx}>
                        {row.map((r, c_inx) => {
                            const [d, v, com] = r
                            if (d == null) {
                                return <td key={c_inx} />
                            } else {
                                return (
                                    <td key={c_inx} className="hasTooltip">{d} <br />{v}
                                        {com != null && <span className="tooltip" dangerouslySetInnerHTML={{ __html: com }} />}
                                    </td>
                                )
                            }
                        })}
                    </tr>
                )
                }
            </tbody>
        </table>
    );
}

function zip_longest() {
    var args = [].slice.call(arguments);
    var longest = args.reduce(function (a, b) {
        return a.length > b.length ? a : b
    }, []);

    return longest.map(function (_, i) {
        return args.map(function (array) { return array[i] })
    });
}

function SummaryTable(props) {
    const data = props.data;
    return (
        <table className="cart">
            <thead>
                <tr>
                    {data['headers'] && data['headers'].map((h, inx) => {
                        return <td key={inx}>{h}</td>
                    })}
                </tr>
            </thead>

            <tbody>
                {data['rows'] && zip_longest(data['rows'], data['_com']).map((row_row_c, inx_r) => {
                    const [row, row_c] = row_row_c
                    return (
                        <tr key={inx_r}>
                            {zip_longest(row, row_c != null ? row_c : []).map((v_com, c_inx) => {
                                const [v, com] = v_com
                                return (
                                    <td key={c_inx} className="hasTooltip">{v}
                                        {com != null && <span className="tooltip" dangerouslySetInnerHTML={{ __html: com }} />}
                                    </td>
                                )
                            })}
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

function NavTable(props) {
    const data = props.data;

    const onLinkClick = (e) => {
        if (props.onLinkClick != null) {
            props.onLinkClick(e.target.search);
        }
    };

    return (
        <table width="100%">
            <tbody>
                <tr>
                    <td> <Link to={"?after=" + data['prev_after'] + "&before=" + data['prev_before']} onClick={onLinkClick}>Prev Period {data['prev_after']} - {data['prev_before']}</Link> </td>
                </tr>
                <tr>
                    <td> <Link to={"?after=" + data['next_after'] + "&before=" + data['next_before']} onClick={onLinkClick}>Next Period {data['next_after']} - {data['next_before']}</Link> </td>
                </tr>
                <tr>
                    <td> <Link to="/" onClick={onLinkClick}>Last Period</Link> </td>
                </tr>
                <tr>
                    <td> <Link to="/upload" onClick={(e) => { window.location.href = e.target.href }}>Upload</Link> </td>
                </tr>
            </tbody>
        </table>
    )
}


function TabPanel(props) {
    const { children, value, index, ...other } = props;
  
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box>
            {children}
          </Box>
        )}
      </div>
    );
  }
  
//   TabPanel.propTypes = {
//     children: PropTypes.node,
//     index: PropTypes.number.isRequired,
//     value: PropTypes.number.isRequired,
//   };
  
  function a11yProps(index) {
    return {
      id: `simple-tab-${index}`,
      'aria-controls': `simple-tabpanel-${index}`,
    };
  }

//   const useMousePosition = () => {
//     const [position, setPosition] = React.useState({
//       clientX: 0,
//       clientY: 0,
//     });
  
//     const updatePosition = event => {
//       const { pageX, pageY, clientX, clientY } = event;
  
//       setPosition({
//         clientX,
//         clientY,
//       });
//     };
  
//     React.useEffect(() => {
//       document.addEventListener("mousemove", updatePosition, false);
//       document.addEventListener("mouseenter", updatePosition, false);
  
//       return () => {
//         document.removeEventListener("mousemove", updatePosition);
//         document.removeEventListener("mouseenter", updatePosition);
//       };
//     }, []);
  
//     return position;
//   };
  
  
function PieChartPage(props) {
    // if (props.data == null || !('by_acc_cur' in props.data)) {
    //     return null
    // }
    
    const data = Object.entries(props.data['by_acc_cur'])
        .filter(([_, v]) => {
            return "total" in v;

        }).map(([k, v]) => {
            // console.log(k, v['total']);
            return {
                "category": k,
                "total" : parseFloat(v['total'])
            }
        });

    let data_by_cat = {}
    data.forEach((e) => {
        data_by_cat[e['category']] = e['total'];
    })
    let data_c = {}
    Object.entries(props.data['by_acc_cur_c']).forEach(([cat,v]) => {
        Object.values(v).forEach((v1) => {
            if (!(cat in data_c)) {
                data_c[cat] = [v1]
            } else {
                data_c[cat].push(v1)
            }
        })
    })

    const [isHovering, setIsHovering] = useState(false);
    const [hoverCat, setHoverCat] = useState(null);

    const PieDetails = () => {
        return (
            <Stack spacing={2}>
                <span>{hoverCat}</span>
                <span dangerouslySetInnerHTML={{ __html: data_c[hoverCat] }} />
            </Stack>
        );
    };
        
    
    const onPointHoverChanged = (e) => {
        const point = e.target;
        const cat = point.data.category;
        setHoverCat(cat);        
        setIsHovering(point.isHovered());
    }

    const onLegendClick = (e) => {
        const point = e.target;
        const cat = point;
        setHoverCat(cat);        
        setIsHovering(true);
    }

    const customizeLegendText = (e) => {
        return e.pointName + ' ' + data_by_cat[e.pointName]
    }

    return (
    <Stack direction="row" spacing={1}>
        <PieChart
            id="pie"
            dataSource={data}
            palette="Bright"
            title="Expenses"
            onPointHoverChanged={onPointHoverChanged}
            onLegendClick={onLegendClick}
        >
            <Legend
                customizeText={customizeLegendText}
            />
            <Series
            argumentField="category"
            valueField="total"
            >
            <Label visible={true}>
                <Connector visible={true} width={1} />
            </Label>
            </Series>

            <Size width={500} />
            <Export enabled={false} />
        </PieChart>
        {isHovering && <PieDetails />}
      </Stack>
    )
}

function ConfigPage() {
    const [conf, setConf] = useState("");
    
    const handleChange = (e) => {
        console.log("new config", e);
        // setConf(e);
        const config = {
            headers: {
                'Content-Type': 'text/plain'
            },
           responseType: 'text'
        };        
        axios.put('/conf', e, config);
    }

    React.useEffect(() => {
        const fetchData = async () => {
            const result = await axios("/conf");
            setConf(result.data);
        };

        fetchData();
    }, []);


    return (

        <MonacoEditor
            value={conf}
            onChange={handleChange}
            language="yaml"
            height="400px"
            options={{
                theme: 'vs-dark',
            }}
        />
    )
}

function Home() {
    const location = useLocation();
    const history = useHistory();

    const query_args = Object.fromEntries(new URLSearchParams(location.search));
    const [slider_value, setSliderValue] = React.useState([query_args['after'], query_args['before']]);

    const onSliderDragStop = () => {
        history.push("?after=" + slider_value[0] + "&before=" + slider_value[1]);
    }

    const [ajax_data, setData] = React.useState(query_args);
    const ajax_query = "/query" + location.search;

    // Tabs
    const [value, setValue] = React.useState(0);

    const handleChange = (event, newValue) => {
      setValue(newValue);
    };
  
    React.useEffect(() => {
        const fetchData = async () => {
            const result = await axios(ajax_query);
            setData(result.data);
            const current_range = [result.data['after'], result.data['before']];
            setSliderValue(current_range);
        };

        fetchData();
    }, [ajax_query]);

    return (
        <Stack spacing={3}>
            <center>Summary {ajax_data['after']} - {ajax_data['before']}</center>
            <Stack direction="row" spacing={1}>
                <Box width={600}>
                    <NavTable data={ajax_data} />
                </Box>
                <MinimumDistanceSlider value={slider_value} setValue={setSliderValue} onChangeCommitted={onSliderDragStop} />
                <Box sx={{ width: 100 }} />
            </Stack>
            <Box sx={{ width: '100%' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                    <Tab label="Calendar" {...a11yProps(0)} />
                    <Tab label="Summary" {...a11yProps(1)} />
                    <Tab label="Pie Chart" {...a11yProps(2)} />
                    <Tab label="Config" {...a11yProps(3)} />
                    </Tabs>
                </Box>
                <TabPanel value={value} index={0}>
                    <ByDayTable data={ajax_data} />
                </TabPanel>
                <TabPanel value={value} index={1}>
                    <SummaryTable data={ajax_data} />
                </TabPanel>
                <TabPanel value={value} index={2}>
                    <PieChartPage data={ajax_data}/>
                </TabPanel>
                <TabPanel value={value} index={3}>
                    <ConfigPage/>
                </TabPanel>
            </Box>
        </Stack>
    );
}

function App() {
    return (
        <Router>
            <Switch>
                <Route path="/">
                    <Home />
                </Route>
            </Switch>
        </Router>
    );
}

export default App;
