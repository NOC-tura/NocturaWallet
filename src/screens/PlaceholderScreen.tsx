import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

export function PlaceholderScreen({name}: {name?: string}) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{name ?? 'Screen'}</Text>
    </View>
  );
}

export function makePlaceholder(name: string) {
  return function Screen() {
    return <PlaceholderScreen name={name} />;
  };
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0C0C14'},
  text: {color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '500'},
});
