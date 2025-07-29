
            var MarchingCubes = (function() {
                
                // http://paulbourke.net/geometry/polygonise/
                var MarchingCubes = function(resolution) {
                    this.resolution = resolution;
                    this.edgeTable = new Int32Array([0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c, 0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00, 0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c, 0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90, 0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c, 0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30, 0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5, 0x4ac, 0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0, 0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c, 0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60, 0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff, 0x3f5, 0x2fc, 0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0, 0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c, 0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950, 0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc, 0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0, 0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc, 0xcc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0, 0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c, 0x15c, 0x55, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650, 0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc, 0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0, 0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c, 0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460, 0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac, 0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0, 0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c, 0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230, 0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c, 0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190, 0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c, 0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0]);
                    this.triTable = new Int32Array([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 0, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 1, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 0, 9, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 3, 2, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 3, 11, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 2, 11, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 3, 11, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 8, 3, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 8, 3, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 8, 3, 2, 10, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 8, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 11, 8, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 8, 10, 2, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 7, 8, 9, 0, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 7, 8, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 10, 9, 0, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, 4, 7, 8, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 3, 11, 1, 9, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, 0, 3, 11, 10, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 3, 11, 10, 4, 7, 8, 1, 9, -1, -1, -1, -1, -1, -1, -1, 4, 7, 3, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 4, 7, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 4, 7, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 4, 7, 2, 10, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 7, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 7, 11, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 4, 7, 11, 10, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 2, 1, 4, 7, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5, 4, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 5, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 5, 4, 10, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 5, 4, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 3, 5, 4, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 5, 4, 11, 3, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 5, 4, 0, 10, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 5, 4, 11, 3, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 5, 4, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 5, 4, 3, 8, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 5, 4, 3, 8, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 5, 4, 2, 10, 0, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, 11, 5, 4, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 5, 4, 8, 1, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 5, 4, 8, 2, 10, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 5, 4, 2, 10, 9, 11, 8, 3, -1, -1, -1, -1, -1, -1, -1, 6, 5, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 10, 9, 0, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 1, 2, 9, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 10, 3, 2, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 10, 9, 0, 1, 11, 3, 2, -1, -1, -1, -1, -1, -1, -1, 6, 5, 1, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 6, 5, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 10, 8, 3, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 10, 9, 3, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 1, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 1, 9, 3, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 10, 11, 8, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 10, 9, 11, 8, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 1, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 5, 1, 9, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 6, 4, 7, 0, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 6, 4, 7, 1, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 0, 1, 6, 4, 7, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, 3, 6, 4, 7, 2, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 0, 1, 6, 4, 7, 11, 3, 2, -1, -1, -1, -1, -1, -1, -1, 0, 3, 11, 10, 6, 4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 6, 4, 10, 1, 9, 11, 3, 0, -1, -1, -1, -1, -1, -1, -1, 8, 6, 4, 7, 3, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 6, 4, 7, 9, 0, 1, 3, -1, -1, -1, -1, -1, -1, -1, -1, 8, 6, 4, 7, 1, 2, 10, 3, 0, -1, -1, -1, -1, -1, -1, -1, 1, 2, 10, 9, 8, 6, 4, 7, 3, 0, -1, -1, -1, -1, -1, -1, 11, 6, 4, 7, 8, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 4, 7, 9, 0, 1, 8, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 4, 7, 1, 2, 10, 8, 0, -1, -1, -1, -1, -1, -1, -1, 1, 2, 10, 9, 11, 6, 4, 7, 8, 0, -1, -1, -1, -1, -1, -1, 9, 5, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 5, 7, 6, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 5, 7, 6, 10, 2, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 5, 7, 6, 10, 2, 1, 0, -1, -1, -1, -1, -1, -1, -1, -1, 11, 5, 7, 6, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 5, 7, 6, 2, 11, 0, 1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 5, 7, 6, 0, 8, 11, 2, -1, -1, -1, -1, -1, -1, -1, -1, 1, 5, 7, 6, 0, 8, 11, 2, 9, 10, -1, -1, -1, -1, -1, -1, 3, 5, 7, 6, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 5, 7, 6, 8, 3, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 5, 7, 6, 8, 3, 1, 2, -1, -1, -1, -1, -1, -1, -1, -1, 9, 5, 7, 6, 8, 3, 1, 2, 10, 0, -1, -1, -1, -1, -1, -1, 11, 5, 7, 6, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 5, 7, 6, 8, 0, 9, 1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 5, 7, 6, 8, 2, 10, 0, -1, -1, -1, -1, -1, -1, -1, -1, 1, 5, 7, 6, 8, 2, 10, 9, 11, 0, -1, -1, -1, -1, -1, -1, 7, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 10, 1, 9, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 1, 0, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 10, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 10, 1, 9, 0, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 1, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 1, 0, 9, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 10, 8, 0, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 10, 9, 0, 1, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 1, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 1, 9, 0, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 10, 11, 8, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 9, 0, 11, 8, 7, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 1, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 2, 1, 0, 9, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 3, 9, 0, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 3, 10, 2, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 9, 1, 10, 2, 11, 6, 3, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 2, 1, 11, 6, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 0, 1, 10, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 6, 3, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 6, 3, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 6, 3, 8, 2, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 6, 3, 8, 1, 10, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 0, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 1, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 2, 8, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, 2, 8, 10, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 3, 7, 4, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 3, 7, 4, 8, 0, 9, 1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 3, 7, 4, 8, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1, 1, 2, 10, 0, 9, 11, 6, 3, 7, 4, 8, -1, -1, -1, -1, -1, 11, 6, 0, 7, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 6, 7, 4, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 2, 10, 11, 6, 7, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 6, 7, 4, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 4, 8, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 7, 4, 8, 6, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 7, 4, 8, 6, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 7, 4, 8, 6, 2, 10, 1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 6, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 6, 11, 8, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 6, 11, 8, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 6, 11, 8, 2, 10, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 5, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 5, 1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 5, 2, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 5, 11, 3, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 5, 0, 1, 11, 3, 2, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 5, 2, 0, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 10, 9, 5, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 5, 9, 0, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 5, 9, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 5, 9, 2, 10, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 5, 9, 0, 10, 3, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 5, 9, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 8, 5, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 8, 5, 9, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 8, 5, 9, 0, 10, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 0, 9, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 2, 10, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 0, 9, 2, 10, 11, 6, 7, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 0, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 0, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 6, 7, 0, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 8, 0, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 9, 0, 1, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 10, 2, 1, 8, 3, 0, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 9, 0, 1, 8, 3, 2, 10, -1, -1, -1, -1, -1, -1, 11, 6, 7, 8, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 6, 7, 8, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 8, 0, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 6, 7, 8, 0, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 9, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 9, 5, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 9, 5, 10, 2, 1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 9, 5, 1, 0, 2, 10, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 5, 0, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 5, 10, 2, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 6, 7, 5, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 8, 3, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 6, 7, 8, 3, 5, 9, 0, -1, -1, -1, -1, -1, -1, -1, 11, 6, 7, 10, 2, 8, 3, 5, 0, 1, -1, -1, -1, -1, -1, -1, 1, 11, 6, 7, 5, 2, 10, 9, 8, 3, 0, -1, -1, -1, -1, -1, 11, 6, 7, 8, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 6, 7, 8, 5, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 11, 6, 7, 8, 5, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 6, 7, 8, 5, 2, 10, 9, -1, -1, -1, -1, -1, -1, -1, 10, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 6, 7, 2, 9, 0, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 6, 7, 2, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 6, 7, 2, 1, 9, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 6, 7, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 9, 0, 3, 11, 10, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, 10, 6, 7, 2, 1, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 9, 0, 11, 3, 10, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, 10, 6, 7, 2, 8, 0, 3, -1, -1, -1, -1, -1, -1, -1, -1, 1, 9, 0, 8, 3, 10, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, 10, 6, 7, 2, 1, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 9, 0, 8, 3, 10, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, 10, 6, 7, 2, 11, 8, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 9, 0, 11, 8, 10, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, 10, 6, 7, 2, 1, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 9, 0, 11, 8, 10, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 2, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 3, 2, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 0, 1, 11, 3, 2, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 2, 0, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 10, 9, 7, 6, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 8, 0, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 8, 3, 1, 2, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 8, 3, 2, 0, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 11, 8, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 10, 9, 7, 6, 11, 8, 2, 0, -1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 10, 9, 7, 6, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1]);
                };
                MarchingCubes.prototype.vertex_interp = function(isolevel, p1, p2, valp1, valp2) {
                    var mu = (isolevel - valp1) / (valp2 - valp1);
                    return { x: p1.x + mu * (p2.x - p1.x), y: p1.y + mu * (p2.y - p1.y), z: p1.z + mu * (p2.z - p1.z) };
                };
                MarchingCubes.prototype.march = function(data, isolevel) {
                    var res = this.resolution, res2 = res*res;
                    var verts = [], faces = [];
                    var vertlist = new Array(12);
                    for (var z = 0; z < res - 1; z++) {
                        for (var y = 0; y < res - 1; y++) {
                            for (var x = 0; x < res - 1; x++) {
                                var p = x + y * res + z * res2;
                                var cubeindex = 0;
                                if (data[p] < isolevel) cubeindex |= 1;
                                if (data[p + 1] < isolevel) cubeindex |= 2;
                                if (data[p + res + 1] < isolevel) cubeindex |= 4;
                                if (data[p + res] < isolevel) cubeindex |= 8;
                                if (data[p + res2] < isolevel) cubeindex |= 16;
                                if (data[p + res2 + 1] < isolevel) cubeindex |= 32;
                                if (data[p + res2 + res + 1] < isolevel) cubeindex |= 64;
                                if (data[p + res2 + res] < isolevel) cubeindex |= 128;
                                var bits = this.edgeTable[cubeindex];
                                if (bits === 0) continue;
                                var p1 = {x:x,y:y,z:z}, p2={x:x+1,y:y,z:z}, p3={x:x+1,y:y+1,z:z}, p4={x:x,y:y+1,z:z}, p5={x:x,y:y,z:z+1}, p6={x:x+1,y:y,z:z+1}, p7={x:x+1,y:y+1,z:z+1}, p8={x:x,y:y+1,z:z+1};
                                if (bits & 1) vertlist[0] = this.vertex_interp(isolevel, p1, p2, data[p], data[p + 1]);
                                if (bits & 2) vertlist[1] = this.vertex_interp(isolevel, p2, p3, data[p + 1], data[p + res + 1]);
                                if (bits & 4) vertlist[2] = this.vertex_interp(isolevel, p3, p4, data[p + res + 1], data[p + res]);
                                if (bits & 8) vertlist[3] = this.vertex_interp(isolevel, p4, p1, data[p + res], data[p]);
                                if (bits & 16) vertlist[4] = this.vertex_interp(isolevel, p5, p6, data[p + res2], data[p + res2 + 1]);
                                if (bits & 32) vertlist[5] = this.vertex_interp(isolevel, p6, p7, data[p + res2 + 1], data[p + res2 + res + 1]);
                                if (bits & 64) vertlist[6] = this.vertex_interp(isolevel, p7, p8, data[p + res2 + res + 1], data[p + res2 + res]);
                                if (bits & 128) vertlist[7] = this.vertex_interp(isolevel, p8, p5, data[p + res2 + res], data[p + res2]);
                                if (bits & 256) vertlist[8] = this.vertex_interp(isolevel, p1, p5, data[p], data[p + res2]);
                                if (bits & 512) vertlist[9] = this.vertex_interp(isolevel, p2, p6, data[p + 1], data[p + res2 + 1]);
                                if (bits & 1024) vertlist[10] = this.vertex_interp(isolevel, p3, p7, data[p + res + 1], data[p + res2 + res + 1]);
                                if (bits & 2048) vertlist[11] = this.vertex_interp(isolevel, p4, p8, data[p + res], data[p + res2 + res]);
                                
                                var i = 0;
                                cubeindex <<= 4;
                                
                                while ((cubeindex + i) < this.triTable.length && this.triTable[cubeindex + i] !== -1) {
                                    
                                    const index1 = this.triTable[cubeindex + i];
                                    const index2 = this.triTable[cubeindex + i + 1];
                                    const index3 = this.triTable[cubeindex + i + 2];
                                
                                    
                                    const v1 = vertlist[index1];
                                    const v2 = vertlist[index2];
                                    const v3 = vertlist[index3];
                                
                                    
                                    
                                    if (v1 && v2 && v3) {
                                        
                                        const baseIndex = verts.length;
                                
                                        
                                        verts.push(v1, v2, v3);
                                        
                                        
                                        faces.push(baseIndex, baseIndex + 1, baseIndex + 2);
                                    }
                                    
                                    
                                    i += 3;
                                }
                            }
                        }
                    }
                    return { vertices: verts, faces: faces };
                };
                return MarchingCubes;
            })();
    
        self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.5.0/math.min.js');
        const linspace=(start,end,num)=>{if(num===0)return[];if(num<=1)return[start];const t=(end-start)/(num-1);return Array.from({length:num},(_,r)=>start+t*r)};
        
        function generateImplicitData({ equation: eq, xMin, xMax, yMin, yMax, zMin, zMax, quality, scope, xMaxOverride, yMaxOverride, zMaxOverride, slicingEnabled, sliceAxes, slicePositions }) {
            const p = math.parse(eq).compile();
            const size = quality * quality * quality;
        
            if (size <= 0 || !isFinite(size)) {
                throw new Error("Invalid quality setting produced a non-positive array size.");
            }
            const d = new Float32Array(size);
        
            let minVal = Infinity, maxVal = -Infinity;
        
            const finalXMax = xMaxOverride !== undefined ? xMaxOverride : xMax;
            const finalYMax = yMaxOverride !== undefined ? yMaxOverride : yMax;
            const finalZMax = zMaxOverride !== undefined ? zMaxOverride : zMax;
        
            const x_step = (finalXMax - xMin) / (quality - 1);
            const y_step = (finalYMax - yMin) / (quality - 1);
            const z_step = (finalZMax - zMin) / (quality - 1);
        
            const sliceWidth = Math.max(x_step, y_step, z_step) * 2.5;
        
            let index = 0;
            for (let k = 0; k < quality; k++) { 
                for (let j = 0; j < quality; j++) { 
                    for (let i = 0; i < quality; i++) { 
                        const x_coord = xMin + i * x_step;
                        const y_coord = yMin + j * y_step;
                        const z_coord = zMin + k * z_step;
        
                        
                        if (slicingEnabled && sliceAxes && sliceAxes.length > 0) {
                            let isOutsideSlice = false;
                            
                            for (const axis of sliceAxes) {
                                const coord = { x: x_coord, y: y_coord, z: z_coord }[axis];
                                const position = slicePositions[axis];
                                if (Math.abs(coord - position) > sliceWidth / 2) {
                                    isOutsideSlice = true;
                                    break; 
                                }
                            }
                            if (isOutsideSlice) {
                                d[index++] = 1e6;
                                continue;
                            }
                        }
                        
        
                        try {
                            const val = p.evaluate({ ...scope, x: x_coord, y: y_coord, z: z_coord });
                            if (isFinite(val)) {
                                d[index++] = val;
                                if (val < minVal) minVal = val;
                                if (val > maxVal) maxVal = val;
                            } else {
                                d[index++] = 1e6;
                            }
                        } catch (err) {
                            d[index++] = 1e6;
                        }
                    }
                }
            }
            const marchingCubes = new MarchingCubes(quality);
            const result = marchingCubes.march(d, 0);
        
            result.vertices.forEach(v => {
                v.x = xMin + v.x * x_step;
                v.y = yMin + v.y * y_step;
                v.z = zMin + v.z * z_step;
            });
        
            return { data: { vertices: result.vertices, faces: result.faces, zMin: minVal, zMax: maxVal }, stats: { dataPoints: result.vertices.length } };
        }

        self.onmessage=function(e){
            const t=e.data;
            try{
                let r;
                switch(t.mode){
                    case"surface":r=generateSurfaceData(t);break;
                    case"vector":r=generateVectorData(t);break;
                    case"parametric":r=generateParametricData(t);break;
                    case"curve":r=generateParametricCurveData(t);break;
                    case"implicit":r=generateImplicitData(t);break

                }
                self.postMessage({status:"success",data:r.data,stats:r.stats,id:t.id})
            }catch(r){
                self.postMessage({status:"error",message:r.message,id:t.id})
            }
        };

        function generateSurfaceData({equation:e,xMin:t,xMax:r,yMin:a,yMax:n,quality:o,xMaxOverride:i,yMaxOverride:l,scope:s}){const c=void 0!==i?i:r,d=void 0!==l?l:n,p=linspace(t,c,o),m=linspace(a,d,o),h=math.parse(e).compile(),f=[],g=[];let u=1/0,v=-1/0;for(const e of m)for(const t of p)try{const r=h.evaluate({...s,x:t,y:e});isFinite(r)?(f.push(t,e,r),g.push(r),r<u&&(u=r),r>v&&(v=r)):(f.push(t,e,0),g.push(NaN))}catch(err){f.push(t,e,0),g.push(NaN)}const w=[];for(let e=0;e<o-1;e++)for(let t=0;t<o-1;t++){const r=e*o+t,a=r+1,n=r+o,s=n+1;w.push(r,n,a),w.push(a,n,s)}return{data:{vertices:new Float32Array(f),indices:new Uint32Array(w),values:new Float32Array(g),width:o,height:o,zMin:u,zMax:v},stats:{dataPoints:o*o}}}
        function generateVectorData({fx:e,fy:t,fz:r,xMin:a,xMax:n,yMin:o,yMax:s,zMin:i,zMax:l,density:c,xMaxOverride:d,yMaxOverride:p,zMaxOverride:h,scope:m}){const g=void 0!==d?d:n,f=void 0!==p?p:s,q=void 0!==h?h:l,v=linspace(a,g,c),b=linspace(o,f,c),w=linspace(i,q,c),y=math.parse(e).compile(),x=math.parse(t).compile(),E=math.parse(r).compile(),M=[],S=c*c*c;let z=1/0,A=-1/0;for(const e of v)for(const t of b)for(const r of w)try{const a={...m,x:e,y:t,z:r},n=y.evaluate(a),o=x.evaluate(a),s=E.evaluate(a);if([n,o,s].every(isFinite)){const i=Math.sqrt(n*n+o*o+s*s);i>1e-6&&(i<z&&(z=i),i>A&&(A=i),M.push({origin:{x:e,y:t,z:r},components:{x:n,y:o,z:s},mag:i}))}}catch(err){}z===1/0&&(z=0);const V={vectors:M,minMag:z,maxMag:A,domain:{xMin:a,xMax:n,yMin:o,yMax:s,zMin:i,zMax:l},density:c};return{data:V,stats:{dataPoints:M.length}}}
        function generateParametricData({xExpr:e,yExpr:t,zExpr:r,uMin:a,uMax:n,vMin:o,vMax:s,quality:i,uMaxOverride:c,vMaxOverride:d,scope:p}){const h=void 0!==c?c:n,m=void 0!==d?d:s,f=linspace(a,h,i),g=linspace(o,m,i),q=math.parse(e).compile(),v=math.parse(t).compile(),b=math.parse(r).compile(),w=[],y=[];let x=1/0,E=-1/0;for(const e of g)for(const t of f)try{const r={...p,u:t,v:e},a=q.evaluate(r),n=v.evaluate(r),o=b.evaluate(r);[a,n,o].every(isFinite)?(w.push(a,n,o),y.push(o),o<x&&(x=o),o>E&&(E=o)):(w.push(0,0,0),y.push(NaN))}catch(err){w.push(0,0,0),y.push(NaN)}const M=[];for(let e=0;e<i-1;e++)for(let t=0;t<i-1;t++){const r=e*i+t,a=r+1,n=r+i,o=n+1;M.push(r,n,a),M.push(a,n,o)}return{data:{vertices:new Float32Array(w),indices:new Uint32Array(M),values:new Float32Array(y),width:i,height:i,zMin:x,zMax:E},stats:{dataPoints:i*i}}}
        function generateParametricCurveData({xExpr:e,yExpr:t,zExpr:r,tMin:a,tMax:n,quality:o,tMaxOverride:i,scope:l}){const c=void 0!==i?i:n,s=linspace(a,c,o),d=math.parse(e).compile(),p=math.parse(t).compile(),h=math.parse(r).compile(),m=[],f=[];for(const e of s)try{const t={...l,t:e},r=d.evaluate(t),n=p.evaluate(t),a=h.evaluate(t);[r,n,a].every(isFinite)&&(m.push(r,n,a),f.push(e))}catch(err){}return{data:{vertices:new Float32Array(m),values:new Float32Array(f),tMin:a,tMax:c},stats:{dataPoints:m.length/3}}}
       
    