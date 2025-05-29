const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => {
            store[key] = value.toString();
        }),
        removeItem: jest.fn((key) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        })
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

const { isValidCidr, ipToLong, longToIp, cidrToRange } = require('./script');

describe('isValidCidr', () => {
    test('should return true for valid CIDR notations', () => {
        expect(isValidCidr("192.168.1.0/24")).toBe(true);
        expect(isValidCidr("10.0.0.0/8")).toBe(true);
        expect(isValidCidr("172.16.0.0/12")).toBe(true);
        expect(isValidCidr("0.0.0.0/0")).toBe(true);
        expect(isValidCidr("255.255.255.255/32")).toBe(true);
    });

    test('should return false for invalid CIDR notations', () => {
        expect(isValidCidr("192.168.1.0")).toBe(false); // Missing prefix
        expect(isValidCidr("192.168.1.0/33")).toBe(false); // Invalid prefix
        expect(isValidCidr("256.168.1.0/24")).toBe(false); // Invalid IP octet
        expect(isValidCidr("192.168.1.0/-1")).toBe(false); // Invalid prefix
        expect(isValidCidr("abc.def.ghi.jkl/24")).toBe(false); // Non-numeric
        expect(isValidCidr("10.0.0.0/8/24")).toBe(false); // Too many slashes
        expect(isValidCidr("10.0.0/24")).toBe(false); // Incomplete IP
    });

    test('should handle edge case prefixes', () => {
        expect(isValidCidr("10.0.0.0/0")).toBe(true);
        expect(isValidCidr("10.0.0.0/32")).toBe(true);
    });

    test('should handle IPs with zero octets', () => {
        expect(isValidCidr("0.0.0.0/16")).toBe(true);
    });
});

describe('ipToLong', () => {
    test('should correctly convert IP addresses to long integers', () => {
        expect(ipToLong("0.0.0.0")).toBe(0);
        expect(ipToLong("10.0.0.1")).toBe(167772161);
        expect(ipToLong("192.168.1.1")).toBe(3232235777);
        expect(ipToLong("255.255.255.255")).toBe(4294967295);
    });
});

describe('longToIp', () => {
    test('should correctly convert long integers to IP addresses', () => {
        expect(longToIp(0)).toBe("0.0.0.0");
        expect(longToIp(167772161)).toBe("10.0.0.1");
        expect(longToIp(3232235777)).toBe("192.168.1.1");
        expect(longToIp(4294967295)).toBe("255.255.255.255");
    });
});

describe('cidrToRange', () => {
    test('should correctly calculate network details for valid CIDR', () => {
        const result = cidrToRange("192.168.1.0/24");
        expect(result.networkAddress).toBe("192.168.1.0");
        expect(result.broadcastAddress).toBe("192.168.1.255");
        expect(result.numAddresses).toBe(256);
        expect(result.startIpLong).toBe(3232235776);
        expect(result.endIpLong).toBe(3232236031);
    });

    test('should handle /32 CIDR correctly', () => {
        const result = cidrToRange("10.0.0.1/32");
        expect(result.networkAddress).toBe("10.0.0.1");
        expect(result.broadcastAddress).toBe("10.0.0.1");
        expect(result.numAddresses).toBe(1);
        expect(result.startIpLong).toBe(167772161);
        expect(result.endIpLong).toBe(167772161);
    });

    test('should handle /0 CIDR correctly', () => {
        const result = cidrToRange("0.0.0.0/0");
        expect(result.networkAddress).toBe("0.0.0.0");
        expect(result.broadcastAddress).toBe("255.255.255.255");
        expect(result.numAddresses).toBe(Math.pow(2, 32));
        expect(result.startIpLong).toBe(0);
        expect(result.endIpLong).toBe(4294967295);
    });

    test('should throw error for invalid CIDR prefix', () => {
        expect(() => cidrToRange("10.0.0.1/33")).toThrow("Invalid CIDR prefix: 10.0.0.1/33");
        expect(() => cidrToRange("10.0.0.1/-1")).toThrow("Invalid CIDR prefix: 10.0.0.1/-1");
    });

    // Note: The original cidrToRange has a commented-out throw for IPs not being network addresses.
    // If that were active, more tests would be needed here.
    // For now, testing based on current implementation.
    test('should correctly process IP that is not the network address for its CIDR block (e.g. /24)', () => {
        const result = cidrToRange("10.0.0.50/24");
        expect(result.networkAddress).toBe("10.0.0.0"); // The function correctly identifies the network address
        expect(result.broadcastAddress).toBe("10.0.0.255");
        expect(result.numAddresses).toBe(256);
        expect(result.startIpLong).toBe(167772160); // 10.0.0.0
        expect(result.endIpLong).toBe(167772415);   // 10.0.0.255
    });
});
