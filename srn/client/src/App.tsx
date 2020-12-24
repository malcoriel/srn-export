import React, { Component } from 'react';
import { Stage, Layer, Rect, Text } from 'react-konva';
import Konva from 'konva';
import useSWR, { SWRConfig } from 'swr';

const DebugState = () => {
  const { data: state } = useSWR('http://localhost:8000/api/state');
  console.log(state);
  return (
    <div
      style={{
        position: 'absolute',
        overflowX: 'hidden',
        overflowY: 'auto',
        left: 0,
        bottom: 0,
        width: 300,
        height: 300,
      }}
    >
      {JSON.stringify(state, null, 2)}
    </div>
  );
};

class ColoredRect extends React.Component {
  state = {
    color: 'green',
  };
  handleClick = () => {
    this.setState({
      color: Konva.Util.getRandomColor(),
    });
  };
  render() {
    return (
      <Rect
        x={20}
        y={20}
        width={50}
        height={50}
        fill={this.state.color}
        shadowBlur={5}
        onClick={this.handleClick}
      />
    );
  }
}

class App extends Component {
  render() {
    // Stage is a div container
    // Layer is actual canvas element (so you may have several canvases in the stage)
    // And then we have canvas shapes inside the Layer
    return (
      <>
        <Stage width={window.innerWidth} height={window.innerHeight}>
          <Layer>
            <Text text="Try click on rect" />
            <ColoredRect />
          </Layer>
        </Stage>
        <SWRConfig
          value={{
            refreshInterval: 1000,
            fetcher: (url, init) => fetch(url, init).then((res) => res.json()),
          }}
        >
          <DebugState />
        </SWRConfig>
      </>
    );
  }
}

export default App;
