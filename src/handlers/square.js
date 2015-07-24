'use strict';

var Immutable = require('immutable');
var xtend = require('xtend');
var Handler = require('./handlers');
var { translatePoint } = require('../util');

/**
 * Square geometry object
 *
 * @param {Object} map - Instance of MapboxGL Map
 * @param {Object} drawStore - The overall drawStore for this session
 * @param {Object} data - GeoJSON polygon feature
 */
function Square(map, drawStore, data) {

  this.initialize(map, drawStore, 'Polygon', data);

  // event handlers
  this.onMouseDown = this._onMouseDown.bind(this);
  this.onMouseMove = this._onMouseMove.bind(this);
  this.completeDraw = this._completeDraw.bind(this);

}

Square.prototype = xtend(Handler, {

  startDraw() {
    this._map.fire('draw.start', { featureType: 'square' });
    this._map.getContainer().classList.add('mapboxgl-draw-activated');
    this._map.getContainer().addEventListener('mousedown', this.onMouseDown, true);
  },

  _onMouseDown(e) {
    this._map.getContainer().removeEventListener('mousedown', this.onMouseDown, true);
    this._map.getContainer().addEventListener('mousemove', this.onMouseMove, true);

    var c = this._map.unproject([e.x, e.y]);
    var arr = [];
    var i = -1;
    while (++i < 5) {
      arr.push([ c.lng, c.lat]);
    }
    this.coordinates = this.coordinates.push(Immutable.fromJS(arr));
  },

  _onMouseMove(e) {
    e.stopPropagation();
    e.preventDefault();

    if (!this.started) {
      this.started = true;
      this._map.getContainer().addEventListener('mouseup', this.completeDraw, true);
    }

    var c = this._map.unproject([e.x, e.y]);
    var orig = this.coordinates.get(0).get(0);
    this.coordinates = this.coordinates.setIn([0, 1], [ orig.get(0), c.lat ]);
    this.coordinates = this.coordinates.setIn([0, 2], [ c.lng, c.lat ]);
    this.coordinates = this.coordinates.setIn([0, 3], [ c.lng, orig.get(1)]);

    this.feature = this.feature.setIn(['geometry', 'coordinates'], this.coordinates);
    this.store.update(this.feature.toJS());
  },

  _completeDraw() {
    this._map.getContainer().classList.remove('mapboxgl-draw-activated');
    this._map.getContainer().removeEventListener('mousemove', this.onMouseMove, true);
    this._map.getContainer().removeEventListener('mouseup', this.completeDraw, true);

    this._done('square');
  },

  moveVertex(init, curr, vertex) {
    if (!this.movingVertex) {
      this.movingVertex = true;

      var coords = vertex.geometry.coordinates;
      var diff = Infinity;

      this.feature.getIn(['geometry', 'coordinates', 0]).forEach((v, i) => {
        var d = Math.sqrt(Math.pow(v.get(0) - coords[0], 2) + Math.pow(v.get(1) - coords[1], 2));
        if (d < diff) {
          this.vertexIdx = i;
          diff = d;
        }
      });
      this.initCoords = this.feature.getIn(['geometry', 'coordinates', 0, this.vertexIdx]);
    }

    var dx = curr.x - init.x;
    var dy = curr.y - init.y;
    var newPoint = translatePoint(this.initCoords.toJS(), dx, dy, this._map);


    this.feature = this.feature.setIn(['geometry', 'coordinates', 0, this.vertexIdx], Immutable.fromJS(newPoint));

    var x = newPoint[0];
    var y = newPoint[1];
    console.log(this.vertexIdx);

    switch (this.vertexIdx) {
      case 0:
        this.feature = this._setV(1, [ x, this._getV(1).get(1) ]);
        this.feature = this._setV(3, [ this._getV(3).get(0), y ]);
        break;
      case 1:
        this.feature = this._setV(0, [ x, this._getV(0).get(1) ]);
        this.feature = this._setV(2, [ this._getV(2).get(0), y ]);
        break;
      case 2:
        this.feature = this._setV(1, [ this._getV(1).get(0), y ]);
        this.feature = this._setV(3, [ x, this._getV(3).get(1) ]);
        break;
      case 3:
        this.feature = this._setV(0, [ this._getV(0).get(0), y ]);
        this.feature = this._setV(2, [ x, this._getV(2).get(1) ]);
        break;
    }

    this.feature = this._setV(4, this._getV(0).toJS());

    this.store.update(this.feature.toJS());
  },

  /**
   * Given and index and a val, set that vertex in `this.feature`
   *
   * @param {Number} idx - index
   * @param {Array<Number>} val - new coordinates
   * @return {Object} an Immutable Map of a GeoJSON feature
   */
  _setV(idx, val) {
    return this.feature.setIn(['geometry', 'coordinates', 0, idx], Immutable.fromJS(val));
  },

  /**
   * Given an index, returns the vertex in the features list of coordinates
   *
   * @param {Number} idx - index of the vertex you want
   * @return {Array<Number>} Immutable List
   */
  _getV(idx) {
    return this.feature.getIn(['geometry', 'coordinates', 0, idx]);
  }

});

module.exports = Square;
