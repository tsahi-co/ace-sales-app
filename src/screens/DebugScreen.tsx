import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Share, SafeAreaView,
} from 'react-native';

// Global log store — survives screen changes
const logBuffer: string[] = [];
const listeners: Array<() => void> = [];

export function addLog(msg: string) {
  const time = new Date().toTimeString().split(' ')[0];
  const entry = `[${time}] ${msg}`;
  logBuffer.push(entry);
  if (logBuffer.length > 500) logBuffer.shift(); // keep last 500
  listeners.forEach(fn => fn());
}

// Monkey-patch console.log to capture [ACE] logs
const _origLog = console.log.bind(console);
console.log = (...args: any[]) => {
  _origLog(...args);
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  if (msg.includes('[ACE]')) addLog(msg.replace('[ACE] ', ''));
};

export default function DebugScreen({ navigation }: any) {
  const [logs, setLogs] = useState<string[]>([...logBuffer]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const refresh = () => setLogs([...logBuffer]);
    listeners.push(refresh);
    return () => { const i = listeners.indexOf(refresh); if (i >= 0) listeners.splice(i, 1); };
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [logs]);

  const handleShare = async () => {
    await Share.share({ message: logBuffer.join('\n'), title: 'ACE Sales Logs' });
  };

  const handleClear = () => {
    logBuffer.length = 0;
    setLogs([]);
  };

  const getColor = (log: string) => {
    if (log.includes('✓') || log.includes('done') || log.includes('complete')) return '#4caf50';
    if (log.includes('✗') || log.includes('Failed') || log.includes('error')) return '#f44336';
    if (log.includes('↻') || log.includes('Retry')) return '#ff9800';
    if (log.includes('══')) return '#e8b400';
    if (log.includes('──')) return '#7799cc';
    return '#aabbcc';
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.toolBtn}>
          <Text style={styles.toolBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.toolTitle}>Debug Logs</Text>
        <View style={styles.toolRight}>
          <TouchableOpacity onPress={handleShare} style={styles.toolBtn}>
            <Text style={styles.toolBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClear} style={styles.toolBtn}>
            <Text style={[styles.toolBtnText, { color: '#f44336' }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>{logs.length} entries</Text>
        <View style={[styles.dot, { backgroundColor: logs.length > 0 ? '#4caf50' : '#445566' }]} />
      </View>

      {/* Log list */}
      <ScrollView ref={scrollRef} style={styles.logList} contentContainerStyle={{ padding: 12 }}>
        {logs.length === 0 ? (
          <Text style={styles.empty}>No logs yet. Run a report to see activity.</Text>
        ) : (
          logs.map((log, i) => (
            <Text key={i} style={[styles.logLine, { color: getColor(log) }]}>
              {log}
            </Text>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0f1e' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#0d1526', borderBottomWidth: 1, borderBottomColor: '#1e2d4a',
  },
  toolTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  toolRight: { flexDirection: 'row', gap: 8 },
  toolBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1a2a40' },
  toolBtnText: { color: '#e8b400', fontSize: 12, fontWeight: '600' },
  statsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: '#0d1526', borderBottomWidth: 1, borderBottomColor: '#1e2d4a',
  },
  statsText: { fontSize: 11, color: '#445566' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  logList: { flex: 1 },
  logLine: { fontSize: 11, fontFamily: 'monospace', marginBottom: 3, lineHeight: 16 },
  empty: { color: '#445566', fontSize: 13, textAlign: 'center', marginTop: 40 },
});
