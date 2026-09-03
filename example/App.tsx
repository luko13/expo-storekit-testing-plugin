import { StatusBar, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>LOCAL DEVELOPMENT</Text>
        <Text style={styles.title}>StoreKit Testing is configured</Text>
        <Text style={styles.body}>
          Run this app from the StoreKitTestingExample scheme in Xcode. The
          local catalog supplies one consumable and one monthly subscription
          without connecting to App Store Connect.
        </Text>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            This example demonstrates native project configuration only. It does
            not implement purchases or represent sandbox, TestFlight, or
            production behavior.
          </Text>
        </View>
      </View>
      <StatusBar barStyle="dark-content" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: '#f4f4ef',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#d7d7ce',
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 560,
    padding: 28,
    width: '100%',
  },
  eyebrow: {
    color: '#526357',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  title: {
    color: '#17221b',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 38,
    marginBottom: 16,
  },
  body: {
    color: '#3e4841',
    fontSize: 17,
    lineHeight: 26,
  },
  notice: {
    backgroundColor: '#e9efe9',
    borderRadius: 12,
    marginTop: 24,
    padding: 16,
  },
  noticeText: {
    color: '#354239',
    fontSize: 14,
    lineHeight: 21,
  },
});
